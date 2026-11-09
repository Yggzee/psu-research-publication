import { useSyncExternalStore } from "react";
import { apiService, type ScholarSearchResult, type ApifyTokenUsage } from "../services/api.service";

export interface AdminSearchState {
  searchQuery: string;
  searchResults: ScholarSearchResult[];
  hasSearched: boolean;
  isSearching: boolean;
  isLoadingMore: boolean;
  searchSource: "cache" | "direct" | "apify" | "none" | null;
  sourceLabel: string;
  cacheNotice: string | null;
  requiresApify: boolean;
  captchaDetected: boolean;
  currentPage: number;
  totalAvailable: number;
  hasMore: boolean;
  lastUsedToken: boolean | null;
  sessionTokensUsed: number;
  assignedResearcherMap: Record<string, string>;
}

const STORAGE_KEY = "psu_admin_search_session_v1";

const initialDefaultState: AdminSearchState = {
  searchQuery: "",
  searchResults: [],
  hasSearched: false,
  isSearching: false,
  isLoadingMore: false,
  searchSource: null,
  sourceLabel: "",
  cacheNotice: null,
  requiresApify: false,
  captchaDetected: false,
  currentPage: 0,
  totalAvailable: 0,
  hasMore: false,
  lastUsedToken: null,
  sessionTokensUsed: 0,
  assignedResearcherMap: {},
};

function loadPersistedState(): AdminSearchState {
  if (typeof window === "undefined") return initialDefaultState;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return initialDefaultState;
    const parsed = JSON.parse(raw);
    return {
      ...initialDefaultState,
      ...parsed,
      isSearching: false, // in-flight will be re-managed in memory
      isLoadingMore: false,
    };
  } catch (err) {
    console.warn("[AdminSearchStore] Failed to load session storage:", err);
    return initialDefaultState;
  }
}

class AdminSearchStore {
  private state: AdminSearchState = loadPersistedState();
  private listeners: Set<() => void> = new Set();
  private activeSearchPromise: Promise<void> | null = null;

  getState = (): AdminSearchState => {
    return this.state;
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify() {
    this.persist();
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error("[AdminSearchStore] Listener error:", err);
      }
    }
  }

  private persist() {
    if (typeof window === "undefined") return;
    try {
      const { isSearching, isLoadingMore, ...toPersist } = this.state;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist));
    } catch (err) {
      console.warn("[AdminSearchStore] Failed to persist state to sessionStorage:", err);
    }
  }

  setAssignedResearcher = (resultId: string, instructorId: string) => {
    this.state = {
      ...this.state,
      assignedResearcherMap: {
        ...this.state.assignedResearcherMap,
        [resultId]: instructorId,
      },
    };
    this.notify();
  };

  executeSearch = async (queryToSearch: string): Promise<void> => {
    const q = queryToSearch.trim();
    if (!q) return;

    // Reset pagination and results, flag active searching
    this.state = {
      ...this.state,
      searchQuery: q,
      searchResults: [],
      hasSearched: true,
      isSearching: true,
      cacheNotice: null,
      requiresApify: false,
      captchaDetected: false,
      searchSource: null,
      currentPage: 0,
      hasMore: false,
    };
    this.notify();

    const searchPromise = (async () => {
      try {
        const response = await apiService.searchGoogleScholar(q, { page: 0 });

        if (response.publicScraperDisabled) {
          this.state = {
            ...this.state,
            cacheNotice: response.message || "Global academic live search is restricted.",
            searchResults: [],
            isSearching: false,
          };
          this.notify();
          return;
        }

        if (response.requiresApify) {
          this.state = {
            ...this.state,
            requiresApify: true,
            captchaDetected: true,
            searchSource: "none",
            searchResults: [],
            isSearching: false,
          };
          this.notify();
          return;
        }

        const isUsedToken = Boolean(response.usedToken);
        const addedTokens = isUsedToken ? 1 : 0;

        this.state = {
          ...this.state,
          searchResults: Array.isArray(response.results) ? response.results : [],
          searchSource: response.searchSource || "direct",
          sourceLabel: response.sourceLabel || "",
          hasMore: Boolean(response.hasMore ?? (response.results?.length >= 5)),
          totalAvailable: response.totalAvailable || response.results?.length || 0,
          currentPage: 0,
          lastUsedToken: isUsedToken,
          sessionTokensUsed: this.state.sessionTokensUsed + addedTokens,
          cacheNotice: response.fromCache
            ? "Retrieved from local database cache (instant response, 0 credits used)."
            : null,
          isSearching: false,
        };
        this.notify();
      } catch (err: any) {
        console.error("[AdminSearchStore] executeSearch error:", err);
        this.state = {
          ...this.state,
          isSearching: false,
        };
        this.notify();
        throw err;
      } finally {
        this.activeSearchPromise = null;
      }
    })();

    this.activeSearchPromise = searchPromise;
    return searchPromise;
  };

  goToPage = async (targetPage: number): Promise<void> => {
    if (targetPage < 0 || this.state.isLoadingMore || this.state.isSearching) return;

    this.state = {
      ...this.state,
      isLoadingMore: true,
    };
    this.notify();

    try {
      const response = await apiService.searchGoogleScholar(this.state.searchQuery, { page: targetPage });

      if (response.requiresApify) {
        this.state = {
          ...this.state,
          requiresApify: true,
          captchaDetected: true,
          isLoadingMore: false,
        };
        this.notify();
        return;
      }

      const isUsedToken = Boolean(response.usedToken);
      const addedTokens = isUsedToken ? 1 : 0;

      this.state = {
        ...this.state,
        searchResults: Array.isArray(response.results) ? response.results : [],
        currentPage: targetPage,
        hasMore: Boolean(response.hasMore),
        totalAvailable: response.totalAvailable || this.state.totalAvailable,
        searchSource: response.searchSource || "direct",
        sourceLabel: response.sourceLabel || "",
        lastUsedToken: isUsedToken,
        sessionTokensUsed: this.state.sessionTokensUsed + addedTokens,
        isLoadingMore: false,
      };
      this.notify();
    } catch (err: any) {
      console.error("[AdminSearchStore] goToPage error:", err);
      this.state = {
        ...this.state,
        isLoadingMore: false,
      };
      this.notify();
      throw err;
    }
  };

  clearSearch = () => {
    this.state = {
      ...initialDefaultState,
      sessionTokensUsed: this.state.sessionTokensUsed, // retain session token tally
    };
    this.notify();
  };
}

export const adminSearchStore = new AdminSearchStore();

export function useAdminSearchStore(): [AdminSearchState, AdminSearchStore] {
  const state = useSyncExternalStore(adminSearchStore.subscribe, adminSearchStore.getState);
  return [state, adminSearchStore];
}

