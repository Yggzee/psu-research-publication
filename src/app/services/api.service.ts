import { API_CONFIG } from '../config/api.config';
import type { Publication, Researcher } from '../data/mockData';

export interface DashboardStatsResponse {
  totalResearchers: number;
  totalPublications: number;
  totalCitations: number;
  averageImpactScore: number;
  topResearchers: Array<{
    id: string;
    name: string;
    department: string;
    citations: number;
    publications: number;
  }>;
  deptYearStats: Array<{
    department: string;
    year: number;
    publications: number;
    citations: number;
  }>;
}

export interface ScholarSearchResult {
  id: string;
  title: string;
  authors: string[];
  journal: string;
  year: number;
  citations: number;
  abstract?: string;
  url?: string;
  citedByLink?: string;
  citedByTotal?: number;
  fromCache?: boolean;
}

export interface ScholarAuthorDetail {
  name: string;
  isPsu: boolean;
  department?: string | null;
}

export interface ScholarProfilePublication {
  id: string;
  title: string;
  authors: string[];
  authorDetails?: ScholarAuthorDetail[];
  psuAuthors?: string[];
  nonPsuAuthors?: string[];
  isPsuPaper?: boolean;
  hasCollaborators?: boolean;
  journal: string;
  year: number;
  citations: number;
  url?: string;
  citedByLink?: string;
  abstract?: string;
}

export interface ScholarProfileData {
  userId: string;
  scholarUrl: string;
  name: string;
  affiliation: string;
  verifiedEmail: string;
  photoUrl?: string;
  totalCitations: number;
  hIndex: number;
  i10Index: number;
  isPsuAffiliated: boolean;
}

export interface FetchScholarProfileResponse {
  success: boolean;
  profile: ScholarProfileData;
  publications: ScholarProfilePublication[];
  totalFound: number;
  usedApify: boolean;
  error?: string;
}

/**
 * Base API Service
 * Handles all HTTP requests to the SQLite Database API
 */
class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || `API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Request to ${url} failed:`, error);
      throw error;
    }
  }

  // 1. Authentication
  async login(loginId: string, password: string) {
    return this.request<{
      user: {
        id: string;
        role: 'admin' | 'instructor';
        name: string;
        username: string;
        email?: string;
        instructorId: string;
        department?: string;
        isFaculty: boolean;
        photoUrl?: string;
      };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: loginId, password }),
    });
  }

  async changePassword(data: { userId?: string; username?: string; currentPassword: string; newPassword: string }) {
    return this.request<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProfile(data: {
    userId?: string;
    username?: string;
    name?: string;
    email?: string;
    department?: string;
    photoUrl?: string;
    scholarUrl?: string;
    googleScholarId?: string;
  }) {
    return this.request<{
      success: boolean;
      user: {
        id: string;
        role: 'admin' | 'instructor';
        name: string;
        username: string;
        email?: string;
        department?: string;
        photoUrl?: string;
        scholarUrl?: string;
        googleScholarId?: string;
      };
    }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getTursoStatus() {
    return this.request<{ isConfigured: boolean; databaseUrl: string; mode: string }>('/turso/status');
  }

  async syncToTurso() {
    return this.request<{ success: boolean; message: string }>('/turso/sync', {
      method: 'POST',
    });
  }

  async getDashboardStats(): Promise<DashboardStatsResponse> {
    return this.request<DashboardStatsResponse>('/dashboard/stats');
  }

  // 3. Researchers
  async getResearchers(): Promise<Researcher[]> {
    return this.request<Researcher[]>('/researchers');
  }

  async getResearcherById(id: string): Promise<Researcher> {
    return this.request<Researcher>(`/researchers/${id}`);
  }

  async createResearcher(data: {
    firstName: string;
    lastName: string;
    instructorId: string;
    password: string;
    department: string;
    isFaculty: boolean;
    photoUrl?: string;
    email?: string;
    scholarUrl?: string;
    googleScholarId?: string;
  }) {
    return this.request('/researchers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateResearcher(id: string, data: Partial<{
    firstName: string;
    lastName: string;
    password?: string;
    department: string;
    isFaculty: boolean;
    photoUrl?: string;
    scholarUrl?: string;
    googleScholarId?: string;
  }>) {
    return this.request(`/researchers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteResearcher(id: string) {
    return this.request(`/researchers/${id}`, {
      method: 'DELETE',
    });
  }

  // 4. Publications
  async getPublications(): Promise<Publication[]> {
    return this.request<Publication[]>('/publications');
  }

  async getPublicationById(id: string): Promise<Publication> {
    return this.request<Publication>(`/publications/${id}`);
  }

  async createPublication(data: Partial<Publication> & {
    ownerId?: string;
    ownerName?: string;
    source?: string;
    approvalStatus?: string;
    researchStatus?: string;
    isPublic?: boolean;
    fileName?: string;
    createdAt?: string;
    citedByLink?: string;
    citingPapers?: Array<{
      title: string;
      authors?: string;
      year?: number;
      link?: string;
    }>;
  }) {
    return this.request('/publications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePublication(id: string, data: Record<string, unknown>) {
    return this.request(`/publications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // 5. Google Scholar & Scraper Caching
  async searchGoogleScholar(query: string, refresh = false): Promise<{
    results: ScholarSearchResult[];
    fromCache: boolean;
    searchSource?: 'cache' | 'direct' | 'apify' | 'none';
    sourceLabel?: string;
    captchaDetected?: boolean;
    count: number;
    requiresApify?: boolean;
    message: string;
    tokenUsage?: ApifyTokenUsage | null;
  }> {
    const refreshParam = refresh ? '&refresh=true' : '';
    return this.request(`/search/google-scholar?q=${encodeURIComponent(query)}${refreshParam}`);
  }

  async fetchScholarProfile(scholarUrl: string): Promise<FetchScholarProfileResponse> {
    return this.request<FetchScholarProfileResponse>('/scholar/fetch-profile', {
      method: 'POST',
      body: JSON.stringify({ scholarUrl }),
    });
  }

  async importScholarPublications(data: {
    instructorId: string;
    researcherName?: string;
    firstName?: string;
    lastName?: string;
    department?: string;
    password?: string;
    email?: string;
    isFaculty?: boolean;
    scholarUrl?: string;
    scholarId?: string;
    photoUrl?: string;
    publications: ScholarProfilePublication[];
  }): Promise<{
    success: boolean;
    importedCount: number;
    updatedCount: number;
    totalSelected: number;
    message: string;
  }> {
    return this.request('/scholar/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // 6. Claims
  async getClaims() {
    return this.request('/claims');
  }

  async reviewClaim(id: string, status: 'approved' | 'rejected') {
    return this.request(`/claims/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  // 7. Apify Token Management
  async getActiveTokenUsage(): Promise<{
    hasActiveToken: boolean;
    tokenUsage: ApifyTokenUsage | null;
  }> {
    return this.request('/apify/tokens/active/usage');
  }

  async getApifyTokens(): Promise<ApifyToken[]> {
    return this.request<ApifyToken[]>('/apify/tokens');
  }

  async addApifyToken(data: {
    name?: string;
    token: string;
    actorId?: string;
  }): Promise<{
    success: boolean;
    message: string;
    token: ApifyToken;
  }> {
    return this.request('/apify/tokens', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async activateApifyToken(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/apify/tokens/${id}/activate`, {
      method: 'PUT',
    });
  }

  async testApifyToken(id: string): Promise<{
    success: boolean;
    status: 'valid' | 'invalid';
    username?: string;
    plan?: string;
    message: string;
  }> {
    return this.request(`/apify/tokens/${id}/test`, {
      method: 'POST',
    });
  }

  async deleteApifyToken(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/apify/tokens/${id}`, {
      method: 'DELETE',
    });
  }
}

export interface ApifyTokenUsage {
  tokenId: string;
  tokenName: string;
  username: string | null;
  plan: string;
  actorId: string;
  limitUsd: number;
  usedUsd: number;
  remainingUsd: number;
  usedPercentage: number;
  cycleEndAt: string | null;
  totalRuns: number | null;
  searchesCount: number;
  status: 'valid' | 'invalid' | 'untested';
  isActive: boolean;
  lastUpdated: string;
}

export interface ApifyToken {
  id: string;
  name: string;
  actorId: string;
  isActive: boolean;
  status: 'valid' | 'invalid' | 'untested';
  username?: string | null;
  plan?: string | null;
  createdAt: string;
  lastTestedAt?: string | null;
  maskedToken: string;
  searchCount?: number;
  monthlyUsageUsd?: number;
  maxMonthlyUsageUsd?: number;
  cycleEndAt?: string | null;
  totalRuns?: number | null;
}

export const apiService = new ApiService();
