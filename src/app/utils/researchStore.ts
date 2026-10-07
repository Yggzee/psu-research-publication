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
  createdAt: string;
}

export interface SessionUser {
  id?: string;
  role: UserRole;
  instructorId?: string;
  username?: string;
  name: string;
  department?: string;
  isFaculty?: boolean;
  photoUrl?: string;
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

export function addResearchRecord(record: StoredPublication) {
  const records = getResearchRecords();
  if (!records.some((item) => item.id === record.id && item.ownerId === record.ownerId)) {
    saveResearchRecords([...records, record]);
  }
  // Also asynchronously sync to SQLite backend
  apiService.createPublication({
    ...record,
    impactScore: record.impactScore || 0,
  }).catch(() => {
    // Graceful offline fallback
  });
}

export function updateResearchRecord(id: string, updates: Partial<StoredPublication>) {
  saveResearchRecords(
    getResearchRecords().map((record) =>
      record.id === id ? { ...record, ...updates } : record,
    ),
  );
  apiService.updatePublication(id, updates).catch(() => {});
}

export function getCurrentUser(): SessionUser {
  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // Fallback below
  }
  return { role: "admin", name: "Admin User", username: "admin" };
}

export function setCurrentUser(user: SessionUser) {
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
}

export function clearCurrentUser() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}
