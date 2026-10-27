import { useState, useEffect, useMemo, type FormEvent } from "react";
import {
  Search,
  User,
  FileText,
  Quote,
  Shield,
  AlertCircle,
  CheckCircle2,
  Eye,
  Save,
  Hand,
  Database,
  Sparkles,
  KeyRound,
  X,
  RefreshCw,
  Zap,
  Plus,
  ExternalLink,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Input } from "./ui/input";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { isPSUPaper, getFacultyList, normalizeTitle } from "../utils/facultyUtils";
import { getCurrentUser, getResearchRecords, addResearchRecord } from "../utils/researchStore";
import { apiService, type ScholarSearchResult, type ApifyTokenUsage } from "../services/api.service";
import { ApifyTokenManager } from "./ApifyTokenManager";
import { toast } from "sonner";
import { PageHeader, StatusBadge, Notice, SectionCard, EmptyState } from "./common";

export function SearchEngine() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ScholarSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [facultyCount, setFacultyCount] = useState(0);
  const [claimedIds, setClaimedIds] = useState<string[]>([]);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [requiresApify, setRequiresApify] = useState(false);
  const [captchaDetected, setCaptchaDetected] = useState(false);
  const [searchSource, setSearchSource] = useState<"cache" | "direct" | "apify" | "none" | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string>("");
  const [showTokenManager, setShowTokenManager] = useState(false);
  const [searchMode, setSearchMode] = useState<"smart" | "author">("smart");
  const [facultyNames, setFacultyNames] = useState<string[]>([]);
  const [tokenUsage, setTokenUsage] = useState<ApifyTokenUsage | null>(null);
  const [isLoadingTokenUsage, setIsLoadingTokenUsage] = useState(false);
  const [savedPublications, setSavedPublications] = useState<any[]>([]);

  const currentUser = getCurrentUser();
  const isInstructor = currentUser.role === "instructor";

  const loadSavedPublications = async () => {
    try {
      const data = await apiService.getPublications();
      setSavedPublications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Could not load repository publications for deduplication:", err);
    }
  };

  const savedTitleMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const p of savedPublications) {
      const norm = normalizeTitle(p.title);
      if (norm) map.set(norm, p);
    }
    return map;
  }, [savedPublications]);

  const isPublicationAlreadySaved = (title: string): boolean => {
    const norm = normalizeTitle(title);
    return norm ? savedTitleMap.has(norm) : false;
  };

  useEffect(() => {
    loadSavedPublications();
    const updateFaculty = async () => {
      try {
        const resList = await apiService.getResearchers().catch(() => []);
        if (Array.isArray(resList) && resList.length > 0) {
          const names = resList.filter((r) => r.isFaculty).map((r) => r.name);
          setFacultyNames(names);
          setFacultyCount(names.length);
          return;
        }
      } catch {}
      const fallback = getFacultyList();
      setFacultyNames(fallback);
      setFacultyCount(fallback.length);
    };
    updateFaculty();

    setClaimedIds(
      getResearchRecords()
        .filter((record) => record.ownerId === currentUser.instructorId && record.source === "claim")
        .map((record) => record.id.replace(/^claim-/, ""))
    );

    const refreshActiveUsage = async (showLoading = false) => {
      if (showLoading) setIsLoadingTokenUsage(true);
      try {
        const res = await apiService.getActiveTokenUsage();
        if (res?.tokenUsage) {
          setTokenUsage(res.tokenUsage);
        }
      } catch (err) {
        console.warn("Could not load initial token usage:", err);
      } finally {
        if (showLoading) setIsLoadingTokenUsage(false);
      }
    };
    refreshActiveUsage(false);

    window.addEventListener("storage", updateFaculty);
    window.addEventListener("research-records-updated", loadSavedPublications);
    return () => {
      window.removeEventListener("storage", updateFaculty);
      window.removeEventListener("research-records-updated", loadSavedPublications);
    };
  }, []);

  const executeSearch = async (queryToSearch: string) => {
    const q = queryToSearch.trim();
    if (!q) return;

    setSearchQuery(q);
    setIsSearching(true);
    setHasSearched(true);
    setCacheNotice(null);
    setRequiresApify(false);
    setCaptchaDetected(false);
    setSearchSource(null);

    const finalQuery = searchMode === "author" && !q.toLowerCase().startsWith("author:") ? `author:"${q}"` : q;

    try {
      const response = await apiService.searchGoogleScholar(finalQuery);

      if (response.requiresApify) {
        setRequiresApify(true);
        setCaptchaDetected(true);
        setSearchSource("none");
        setSearchResults([]);
        return;
      }

      setSearchResults(response.results);
      setIsFromCache(Boolean(response.fromCache));
      setSearchSource(response.searchSource || "direct");
      setSourceLabel(response.sourceLabel || "");

      if (response.fromCache) {
        setCacheNotice("Retrieved from local database cache (instant response, 0 credits used).");
      }

      // Refresh token limits in background
      apiService.getActiveTokenUsage().then((res) => {
        if (res?.tokenUsage) setTokenUsage(res.tokenUsage);
      });
    } catch (err: any) {
      console.error("Search error:", err);
      toast.error(err.message || "Search failed. Check your network or Apify connection.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    executeSearch(searchQuery);
  };

  const handleSavePublication = async (result: ScholarSearchResult) => {
    if (isPSUPaper(result.authors)) {
      if (isPublicationAlreadySaved(result.title)) {
        toast.info(`Publication already exists in repository.`);
        return;
      }

      const newRecord = {
        id: result.id,
        title: result.title,
        authors: result.authors,
        journal: result.journal,
        year: result.year,
        citations: result.citations,
        abstract: result.abstract,
        url: result.url,
        citedByLink: result.citedByLink,
        ownerId: currentUser.instructorId || "admin",
        ownerName: currentUser.name,
        source: "scraped" as const,
        approvalStatus: "approved" as const,
        researchStatus: "Published" as const,
        isPublic: true,
        createdAt: new Date().toISOString(),
      };

      addResearchRecord(newRecord);
      const res: any = await apiService.createPublication(newRecord).catch(() => null);
      if (res?.isDuplicate) {
        toast.info(`Publication already exists in repository.`);
      } else {
        toast.success(`✓ "${result.title}" permanently added to repository!`);
      }
      await loadSavedPublications();
      window.dispatchEvent(new CustomEvent("research-records-updated"));
    } else {
      toast.error(`Cannot save Non-PSU paper (no faculty authors).`);
    }
  };

  const handleClaimPublication = async (result: ScholarSearchResult) => {
    if (isPublicationAlreadySaved(result.title)) {
      const existing = savedTitleMap.get(normalizeTitle(result.title));
      if (existing?.owner_id === currentUser.instructorId || existing?.ownerId === currentUser.instructorId) {
        toast.info(`You have already claimed this publication.`);
        return;
      }
    }

    const claimRecord = {
      id: `claim-${result.id}`,
      title: result.title,
      authors: result.authors,
      journal: result.journal,
      year: result.year,
      citations: result.citations,
      abstract: result.abstract,
      url: result.url,
      citedByLink: result.citedByLink,
      ownerId: currentUser.instructorId || "",
      ownerName: currentUser.name,
      source: "claim" as const,
      approvalStatus: "pending" as const,
      researchStatus: "Published" as const,
      isPublic: true,
      createdAt: new Date().toISOString(),
    };

    addResearchRecord(claimRecord);
    const res: any = await apiService.createPublication(claimRecord).catch(() => null);
    if (res?.isDuplicate) {
      toast.info(`Publication already exists in repository; authorship linked.`);
    } else {
      toast.success(`✓ Claim submitted for "${result.title}"!`);
    }
    setClaimedIds((ids) => [...ids, result.id]);
    await loadSavedPublications();
    window.dispatchEvent(new CustomEvent("research-records-updated"));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* 1. Page Header */}
      <PageHeader
        title="Google Scholar Search"
        description="Query live academic literature with automatic SQLite caching and registered PSU faculty author matching"
        actions={
          <div className="flex items-center gap-2">
            {tokenUsage ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTokenManager(true)}
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                title="Apify scraper quota"
              >
                <KeyRound className="w-3.5 h-3.5 text-warning" />
                <span className="font-mono text-xs">${tokenUsage.remainingUsd.toFixed(2)} quota</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTokenManager(true)}
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <KeyRound className="w-3.5 h-3.5 text-warning" />
                <span>Scraper Settings</span>
              </Button>
            )}
          </div>
        }
      />

      {/* 2. SEARCH BAR FIRST (Primary User Action) */}
      <Card className="bg-card border-border/70 shadow-2xs">
        <CardContent className="p-3.5 sm:p-5 space-y-3">
          {/* Mode Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
            <span className="text-xs font-medium text-muted-foreground">Search Mode:</span>
            <div className="grid grid-cols-2 sm:flex sm:items-center p-0.5 rounded-lg bg-muted/50 border border-border/60 text-xs">
              <button
                type="button"
                onClick={() => setSearchMode("smart")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer text-center ${
                  searchMode === "smart"
                    ? "bg-card text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="sm:hidden">Smart Search</span>
                <span className="hidden sm:inline">Smart Search (Topic & Author)</span>
              </button>
              <button
                type="button"
                onClick={() => setSearchMode("author")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer text-center ${
                  searchMode === "author"
                    ? "bg-card text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="sm:hidden">Author Only</span>
                <span className="hidden sm:inline">Author Filter (author:...)</span>
              </button>
            </div>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder={
                  searchMode === "author"
                    ? "Enter author name (e.g. Julius Oscar Moreno)"
                    : "Search researcher, paper title, or topic..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 sm:h-10 text-xs sm:text-sm bg-background"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="h-9 sm:h-10 px-3.5 sm:px-6 text-xs sm:text-sm font-semibold bg-brand hover:bg-brand/90 text-white shadow-2xs shrink-0"
            >
              {isSearching ? (
                <>
                  <RefreshCw className="w-4 h-4 sm:mr-2 animate-spin" />
                  <span className="hidden sm:inline">Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 sm:hidden" />
                  <span className="hidden sm:inline">Search</span>
                </>
              )}
            </Button>
          </form>

          {/* Quick Faculty Search Chips */}
          {facultyNames.length > 0 && (
            <div className="pt-1 flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
              <span className="flex items-center gap-1 shrink-0 text-[11px]">
                <User className="w-3 h-3 text-brand" /> Quick author search:
              </span>
              {facultyNames.slice(0, 6).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => executeSearch(name)}
                  className="text-[11px] bg-muted/60 hover:bg-brand-soft hover:text-brand hover:border-brand/40 border border-border/70 px-2.5 py-0.5 rounded-full transition-colors font-medium text-foreground"
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. DYNAMIC NOTICE SLOT (One slot for all alerts) */}
      {requiresApify && searchResults.length === 0 && !isSearching && (
        <Notice
          variant="warning"
          title="Google Scholar Rate Limit / Anti-Bot Lock"
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowTokenManager(true)}
              className="text-xs h-7 border-warning-border hover:bg-warning-soft"
            >
              Connect Apify Token
            </Button>
          }
        >
          Google Scholar has challenged direct queries. Connect a free Apify token ($5 free monthly credits) to activate the proxy failover shield and continue searching.
        </Notice>
      )}

      {isSearching && (
        <Notice variant="info" title="Searching Google Scholar...">
          Querying local database cache and academic literature directly to save token credits.
        </Notice>
      )}

      {hasSearched && !isSearching && searchResults.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            Found <strong>{searchResults.length}</strong> publication results for "{searchQuery}"
          </span>
          {searchSource && (
            <span className="font-medium">
              Source: {searchSource === "cache" ? "⚡ Local SQLite Cache" : searchSource === "direct" ? "🌐 Direct Scholar" : "🛡️ Apify Failover"}
            </span>
          )}
        </div>
      )}

      {/* 4. RESULTS SECTION */}
      {hasSearched && !isSearching && searchResults.length === 0 && !requiresApify && (
        <EmptyState
          icon={AlertCircle}
          title="No Publications Found"
          description={`No academic literature matched "${searchQuery}". Try searching with alternate keywords, author surname, or a broader topic.`}
        />
      )}

      {searchResults.length > 0 && (
        <div className="space-y-3">
          {searchResults.map((result) => {
            const isPSU = isPSUPaper(result.authors);
            const isSaved = isPublicationAlreadySaved(result.title);
            const isClaimed = claimedIds.includes(result.id);

            return (
              <Card
                key={result.id}
                className="bg-card border-border/70 shadow-2xs hover:border-brand/40 transition-colors p-4 sm:p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-semibold text-foreground leading-snug">
                        {result.url ? (
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-brand hover:underline inline-flex items-center gap-1.5"
                          >
                            <span>{result.title}</span>
                            <ExternalLink className="w-3 h-3 text-muted-foreground" />
                          </a>
                        ) : (
                          result.title
                        )}
                      </h3>

                      <StatusBadge
                        status={isPSU ? "verified" : "unpublished"}
                        label={isPSU ? "PSU Faculty Paper" : "External / Non-PSU"}
                      />

                      {isSaved && (
                        <StatusBadge status="approved" label="In Repository" />
                      )}
                      {isClaimed && (
                        <StatusBadge status="pending" label="Claim Submitted" />
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Authors: <span className="text-foreground">{result.authors.join(", ")}</span>
                    </p>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                      <span>Year: {result.year}</span>
                      <span>Journal: {result.journal || "Academic Source"}</span>
                      {result.citations > 0 && (
                        <span className="text-brand font-semibold">
                          Citations: {result.citations}
                        </span>
                      )}
                    </div>

                    {result.abstract && (
                      <p className="text-xs text-muted-foreground pt-1 line-clamp-2 leading-relaxed">
                        {result.abstract}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-start w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-border/50 flex-wrap sm:flex-nowrap justify-start sm:justify-end">
                    {/* Save to Repository (for PSU papers) */}
                    {isPSU && !isSaved && !isInstructor && (
                      <Button
                        size="sm"
                        onClick={() => handleSavePublication(result)}
                        className="h-8 text-xs bg-success hover:bg-success/90 text-white gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save to Repository</span>
                      </Button>
                    )}

                    {/* Claim Paper (for instructors) */}
                    {isInstructor && !isClaimed && (
                      <Button
                        size="sm"
                        onClick={() => handleClaimPublication(result)}
                        className="h-8 text-xs bg-brand hover:bg-brand/90 text-white gap-1.5"
                      >
                        <Hand className="w-3.5 h-3.5" />
                        <span>Claim Authorship</span>
                      </Button>
                    )}

                    {result.citedByLink && (
                      <a
                        href={result.citedByLink}
                        target="_blank"
                        rel="noreferrer"
                        className="h-8 px-2.5 rounded-lg border border-border/70 hover:bg-muted/50 text-xs text-muted-foreground inline-flex items-center gap-1 transition-colors"
                      >
                        <Quote className="w-3 h-3 text-brand" />
                        <span>Cited by {result.citations}</span>
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Token Manager Modal */}
      {showTokenManager && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowTokenManager(false)}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border/70 bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-brand-soft text-brand rounded-lg">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Scraper Token Management</h3>
                  <p className="text-xs text-muted-foreground">Manage Apify scraping tokens for Google Scholar fallback queries</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowTokenManager(false)}
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <ApifyTokenManager
              compact={true}
              onTokenChanged={() => {
                setRequiresApify(false);
                apiService.getActiveTokenUsage().then((res) => {
                  if (res?.tokenUsage) setTokenUsage(res.tokenUsage);
                });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
