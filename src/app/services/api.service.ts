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

export interface PendingRegistration {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  instructorId: string;
  email: string;
  department: string;
  isFaculty: boolean;
  scholarUrl?: string;
  googleScholarId?: string;
  status: 'pending_verification' | 'pending_email_verification' | 'pending_approval' | 'rejected' | 'active';
  registrationType: 'admin_invite' | 'self_registration' | 'manual';
  isEmailVerified: boolean;
  emailVerifiedAt?: string;
  verificationToken?: string;
  hasScholar: boolean;
  createdAt: string;
}

export interface EmailLog {
  id: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  email_type: string;
  verification_token?: string;
  verification_link?: string;
  html_content?: string;
  status: string;
  created_at: string;
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
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('psu_auth_token') : null;
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...authHeaders,
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
    const res = await this.request<{
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
      token?: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: loginId, password }),
    });

    if (res && res.token && typeof window !== 'undefined') {
      sessionStorage.setItem('psu_auth_token', res.token);
    }

    return res;
  }

  // Self-Registration
  async register(data: {
    firstName: string;
    lastName: string;
    instructorId: string;
    email: string;
    password: string;
    department: string;
    isFaculty: boolean;
    scholarUrl?: string;
    hasScholar: boolean;
  }) {
    return this.request<{
      success: boolean;
      message: string;
      email: string;
      verificationLink?: string;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Verify email from token link
  async verifyEmail(token: string) {
    return this.request<{
      success: boolean;
      status: string;
      message: string;
      user?: any;
    }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  // Validate invitation or verification token
  async verifyToken(token: string) {
    return this.request<{
      valid: boolean;
      error?: string;
      user?: {
        id: string;
        name: string;
        firstName?: string;
        lastName?: string;
        instructorId: string;
        email: string;
        department: string;
        status: string;
        registrationType: string;
      };
    }>(`/auth/verify-token?token=${encodeURIComponent(token)}`);
  }

  // Complete invitation & set password
  async completeInvitation(token: string, newPassword: string) {
    return this.request<{
      success: boolean;
      message: string;
      user: any;
    }>('/auth/complete-invitation', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
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
    password?: string;
    department: string;
    isFaculty: boolean;
    photoUrl?: string;
    email: string;
    scholarUrl?: string;
    googleScholarId?: string;
    sendInvite?: boolean;
  }) {
    return this.request<{
      success: boolean;
      message: string;
      verificationLink?: string;
      researcher: any;
    }>('/researchers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Admin: Get pending researcher registrations
  async getPendingRegistrations(): Promise<PendingRegistration[]> {
    return this.request<PendingRegistration[]>('/admin/pending-registrations');
  }

  // Admin: Admit / Approve registration
  async admitRegistration(instructorId: string) {
    return this.request<{ success: boolean; message: string }>('/admin/admit-registration', {
      method: 'POST',
      body: JSON.stringify({ instructorId }),
    });
  }

  // Admin: Reject registration
  async rejectRegistration(instructorId: string, reason?: string) {
    return this.request<{ success: boolean; message: string }>('/admin/reject-registration', {
      method: 'POST',
      body: JSON.stringify({ instructorId, reason }),
    });
  }

  // Admin: Resend verification / invitation email
  async resendInvite(instructorId: string) {
    return this.request<{ success: boolean; message: string; verificationLink?: string }>('/admin/resend-invite', {
      method: 'POST',
      body: JSON.stringify({ instructorId }),
    });
  }

  // Admin: View email outbox
  async getEmailLogs(): Promise<EmailLog[]> {
    return this.request<EmailLog[]>('/admin/email-logs');
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

  async deletePublication(id: string) {
    return this.request<{ success: boolean; message: string }>(`/publications/${id}`, {
      method: 'DELETE',
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

  // --- Intelligence & Capstone Innovation Methods ---

  async getSystemStatus(): Promise<SystemStatusResponse> {
    return this.request('/intelligence/system-status');
  }

  async getSDGStats(): Promise<SDGStatsResponse> {
    return this.request('/intelligence/sdg-stats');
  }

  async getNetworkGraph(): Promise<NetworkGraphResponse> {
    return this.request('/intelligence/network-graph');
  }

  async askCampusAI(question: string, history?: Array<{ sender: string; text: string }>): Promise<AskCampusResponse> {
    return this.request('/ai/ask-campus', {
      method: 'POST',
      body: JSON.stringify({ question, history }),
    });
  }

  async askCampusIntelligence(question: string, history?: Array<{ sender: string; text: string }>): Promise<AskCampusResponse> {
    return this.askCampusAI(question, history);
  }

  async getAIChatSessions(userId?: string): Promise<{ sessions: AIChatSession[] }> {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return this.request(`/ai/chat-sessions${query}`);
  }

  async saveAIChatSession(session: {
    id: string;
    userId?: string;
    title: string;
    messages: AIChatMessage[];
  }): Promise<{ success: boolean; id: string }> {
    return this.request('/ai/chat-sessions', {
      method: 'POST',
      body: JSON.stringify(session),
    });
  }

  async deleteAIChatSession(id: string): Promise<{ success: boolean }> {
    return this.request(`/ai/chat-sessions?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async clearAIChatHistory(userId?: string): Promise<{ success: boolean }> {
    const query = userId ? `&userId=${encodeURIComponent(userId)}` : '';
    return this.request(`/ai/chat-sessions?clearAll=true${query}`, {
      method: 'DELETE',
    });
  }

  async classifyPublicationSDG(payload: {
    publicationId?: string;
    title?: string;
    abstract?: string;
    journal?: string;
  }): Promise<{
    success: boolean;
    sdg: { primarySDG: string; secondarySDG: string; rationale: string; chedPriority: string };
    audit: { indexing: string; nbc461Points: number; isPredatory: number; confidence: string };
  }> {
    return this.request('/ai/classify-sdg', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async batchClassifySDG(): Promise<{ success: boolean; processed: number; remaining: number }> {
    return this.request('/ai/batch-classify-sdg', {
      method: 'POST',
    });
  }

  async calculateSynergy(researcherIdA: string, researcherIdB: string): Promise<SynergyMatchResponse> {
    return this.request('/ai/synergy-match', {
      method: 'POST',
      body: JSON.stringify({ researcherIdA, researcherIdB }),
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

export interface SystemStatusResponse {
  status: string;
  aiEngine: string;
  aiModel: string;
  keyConfigured: boolean;
  dbSync: string;
  totalPublications: number;
  totalResearchers: number;
  classifiedPublications: number;
  timestamp: string;
}

export interface SDGPaperItem {
  id: string;
  title: string;
  authors: string[];
  journal?: string;
  year: number;
  citations: number;
  abstract?: string;
  url?: string;
  sdgRationale?: string;
  sdgRationales?: Record<string, string>;
  chedPriority?: string;
  sdgTags?: string[];
  ownerName?: string;
  journalIndexing?: string;
  nbc461Points?: number;
}

export interface SDGStatsResponse {
  radarData: Array<{
    sdg: string;
    fullName: string;
    count: number;
    fullLabel: string;
    papers: SDGPaperItem[];
  }>;
  totalClassified: number;
  chedPriorities: Array<{
    priority: string;
    count: number;
  }>;
}

export interface NetworkGraphNode {
  id: string;
  name: string;
  department: string;
  publications: number;
  citations: number;
  photoUrl?: string;
}

export interface NetworkGraphLink {
  source: string;
  target: string;
  weight: number;
  papers: string[];
}

export interface SynergyCandidate {
  researcherA: { id: string; name: string; department: string };
  researcherB: { id: string; name: string; department: string };
  potentialScore: number;
}

export interface NetworkGraphResponse {
  nodes: NetworkGraphNode[];
  links: NetworkGraphLink[];
  synergyCandidates: SynergyCandidate[];
}

export interface SynergyMatchResponse {
  synergyScore: number;
  proposedTitle: string;
  rationale: string;
}

export interface CitedPaper {
  id: string;
  refId: number;
  title: string;
  authors: string | string[];
  year: number;
  journal?: string;
}

export interface AskCampusResponse {
  answer: string;
  citedPapers: CitedPaper[];
  source: 'gemini' | 'heuristic' | 'guardrail';
}

export interface AIChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  citedPapers?: CitedPaper[];
  timestamp: string;
  isGuardrailRefusal?: boolean;
}

export interface AIChatSession {
  id: string;
  userId?: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: AIChatMessage[];
}

export const apiService = new ApiService();
