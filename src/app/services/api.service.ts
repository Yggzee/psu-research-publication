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
  fromCache?: boolean;
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

  // 2. Dashboard
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
  async searchGoogleScholar(query: string): Promise<{
    results: ScholarSearchResult[];
    fromCache: boolean;
    count: number;
    requiresApify?: boolean;
    message: string;
  }> {
    return this.request(`/search/google-scholar?q=${encodeURIComponent(query)}`);
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
}

export const apiService = new ApiService();
