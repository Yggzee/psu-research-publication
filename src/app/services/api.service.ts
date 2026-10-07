import { API_CONFIG, API_ENDPOINTS } from '../config/api.config';
import { Researcher, Publication } from '../data/mockData';

/**
 * Base API Service
 * Handles all HTTP requests to the Laravel backend
 */
class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
  }

  /**
   * Generic fetch wrapper with error handling
   */
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
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Request Failed:', error);
      throw error;
    }
  }

  /**
   * Authentication
   */
  async login(email: string, password: string) {
    return this.request(API_ENDPOINTS.LOGIN, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  /**
   * Get all researchers
   */
  async getResearchers(): Promise<Researcher[]> {
    return this.request<Researcher[]>(API_ENDPOINTS.RESEARCHERS);
  }

  /**
   * Get researcher by ID
   */
  async getResearcherById(id: string): Promise<Researcher> {
    return this.request<Researcher>(API_ENDPOINTS.RESEARCHER_BY_ID(id));
  }

  /**
   * Get researcher publications
   */
  async getResearcherPublications(id: string): Promise<Publication[]> {
    return this.request<Publication[]>(API_ENDPOINTS.RESEARCHER_PUBLICATIONS(id));
  }

  /**
   * Get publication by ID
   */
  async getPublicationById(id: string): Promise<Publication> {
    return this.request<Publication>(API_ENDPOINTS.PUBLICATION_BY_ID(id));
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats() {
    return this.request(API_ENDPOINTS.DASHBOARD_STATS);
  }

  /**
   * Trigger Google Scholar scraping via Apify
   * This calls your Laravel backend, which then calls Apify
   */
  async triggerScrapingJob(researcherName: string, scholarUrl?: string) {
    return this.request(API_ENDPOINTS.TRIGGER_SCRAPING, {
      method: 'POST',
      body: JSON.stringify({ researcherName, scholarUrl }),
    });
  }

  /**
   * Check scraping job status
   */
  async getScrapingStatus(jobId: string) {
    return this.request(API_ENDPOINTS.SCRAPING_STATUS(jobId));
  }

  /**
   * Search Google Scholar
   */
  async searchGoogleScholar(query: string) {
    return this.request(API_ENDPOINTS.SEARCH_GOOGLE_SCHOLAR, {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }
}

export const apiService = new ApiService();
