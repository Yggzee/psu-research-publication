/**
 * API Configuration
 * 
 * Configure your Laravel backend URL here.
 * For development, use your local Laravel server (e.g., http://localhost:8000)
 * For production, use your deployed Laravel API URL
 */

export const API_CONFIG = {
  // Use relative /api endpoint (handled by SQLite plugin) or custom remote host
  BASE_URL: import.meta.env.VITE_API_BASE_URL || '/api',
  
  // API timeout in milliseconds
  TIMEOUT: 30000,
  
  // Connect directly to SQLite database - No mock data
  USE_MOCK_DATA: false,
};

/**
 * API Endpoints
 * These should match your Laravel routes
 */
export const API_ENDPOINTS = {
  // Authentication
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  REGISTER: '/auth/register',
  
  // Dashboard
  DASHBOARD_STATS: '/dashboard/stats',
  
  // Researchers
  RESEARCHERS: '/researchers',
  RESEARCHER_BY_ID: (id: string) => `/researchers/${id}`,
  RESEARCHER_PUBLICATIONS: (id: string) => `/researchers/${id}/publications`,
  
  // Publications
  PUBLICATIONS: '/publications',
  PUBLICATION_BY_ID: (id: string) => `/publications/${id}`,
  PUBLICATIONS_BY_YEAR: '/publications/by-year',
  
  // Citations
  CITATION_GROWTH: '/citations/growth',
  TOP_RESEARCHERS: '/researchers/top',
  
  // Impact Analysis
  IMPACT_ANALYSIS: (id: string) => `/publications/${id}/impact`,
  
  // Search & Scraping
  SEARCH_GOOGLE_SCHOLAR: '/search/google-scholar',
  TRIGGER_SCRAPING: '/scraping/trigger',
  SCRAPING_STATUS: (jobId: string) => `/scraping/status/${jobId}`,
};
