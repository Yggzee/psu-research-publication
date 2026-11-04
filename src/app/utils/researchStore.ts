import { apiService } from "../services/api.service";

export type UserRole = "admin" | "instructor";
export type ResearchStatus = "In Progress" | "Unpublished" | "Published";

export interface ManagedResearcher {
  id?: string;
  lastName: string;
  firstName: string;
  name: string;
  instructorId: string;
  password?: string;
  email?: string;
  department: string;
  isFaculty: boolean;
  photoUrl?: string;
  scholarUrl?: string;
  googleScholarId?: string;
  totalPublications?: number;
  totalCitations?: number;
}

export interface StoredPublication {
  id: string;
  title: string;
  authors: string[];
  journal: string;
  year: number;
  citations: number;
  abstract?: string;
  url?: string;
  impactScore?: number;
  ownerId: string;
  ownerName: string;
  source: "claim" | "manual" | "admin" | "scraped";
  approvalStatus: "pending" | "approved" | "rejected";
  researchStatus: ResearchStatus;
  isPublic: boolean;
  fileName?: string;
  citedByLink?: string;
  citingPapers?: Array<{
    title: string;
    authors?: string;
    year?: number;
    link?: string;
  }>;
  createdAt: string;
}

export interface SessionUser {
  id?: string;
  role: UserRole;
  instructorId?: string;
  username?: string;
  email?: string;
  name: string;
  department?: string;
  isFaculty?: boolean;
  photoUrl?: string;
  scholarUrl?: string;
  googleScholarId?: string;
}

export const FACULTY_DATA_KEY = "psu_faculty_data";
export const PUBLICATIONS_STORAGE_KEY = "psu_research_records";
export const SESSION_STORAGE_KEY = "psu_current_user";

// Default managed researchers starts completely empty (No mock data!)
export function getDefaultManagedResearchers(): ManagedResearcher[] {
  return [];
}

export function getManagedResearchers(): ManagedResearcher[] {
  const stored = localStorage.getItem(FACULTY_DATA_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored) as ManagedResearcher[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveManagedResearchers(researchers: ManagedResearcher[]) {
  localStorage.setItem(FACULTY_DATA_KEY, JSON.stringify(researchers));
  localStorage.setItem(
    "psu_faculty_members",
    JSON.stringify(researchers.filter((r) => r.isFaculty).map((r) => r.name))
  );
  window.dispatchEvent(new Event("storage"));
}

export function getResearchRecords(): StoredPublication[] {
  try {
    return JSON.parse(localStorage.getItem(PUBLICATIONS_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveResearchRecords(records: StoredPublication[]) {
  localStorage.setItem(PUBLICATIONS_STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event("research-records-updated"));
}

export function addResearchRecord(record: StoredPublication, syncBackend = false) {
  const records = getResearchRecords();
  if (!records.some((item) => item.id === record.id && item.ownerId === record.ownerId)) {
    saveResearchRecords([...records, record]);
  }
  if (syncBackend) {
    apiService.createPublication({
      ...record,
      impactScore: record.impactScore || 0,
    }).catch(() => {
      // Graceful offline fallback
    });
  }
}

export function removeResearcherRecordsFromLocal(instructorId: string, researcherName?: string) {
  const idLower = (instructorId || "").trim().toLowerCase();
  const nameLower = (researcherName || "").trim().toLowerCase();
  const filtered = getResearchRecords().filter((record) => {
    const rOwnerId = (record.ownerId || "").trim().toLowerCase();
    const rOwnerName = (record.ownerName || "").trim().toLowerCase();
    if (idLower && rOwnerId === idLower) return false;
    if (nameLower && rOwnerName === nameLower) return false;
    return true;
  });
  saveResearchRecords(filtered);
}

export function updateResearchRecord(id: string, updates: Partial<StoredPublication>) {
  saveResearchRecords(
    getResearchRecords().map((record) =>
      record.id === id ? { ...record, ...updates } : record,
    ),
  );
  apiService.updatePublication(id, updates).catch(() => {});
}

export function deleteResearchRecord(id: string) {
  saveResearchRecords(
    getResearchRecords().filter((record) => record.id !== id),
  );
  apiService.deletePublication(id).catch(() => {});
}

export const AUTH_TOKEN_KEY = "psu_auth_token";

export function getAuthToken(): string | null {
  try {
    return sessionStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string) {
  try {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {}
}

export function getStoredUser(): SessionUser | null {
  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    return null;
  }
  return null;
}

export function isAuthenticated(): boolean {
  return getStoredUser() !== null;
}

export function getCurrentUser(): SessionUser | null {
  return getStoredUser();
}

export function setCurrentUser(user: SessionUser, token?: string) {
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
  if (token) {
    setAuthToken(token);
  } else {
    // Ensure session token exists even in offline or fallback logins
    setAuthToken(`psu_local_token_${Date.now()}_${user.role}`);
  }
}

export function clearCurrentUser() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

export function updateCurrentUser(updates: Partial<SessionUser>): SessionUser | null {
  const current = getCurrentUser();
  if (!current) return null;
  const updated: SessionUser = { ...current, ...updates };
  setCurrentUser(updated);
  window.dispatchEvent(new Event("current-user-updated"));
  return updated;
}
