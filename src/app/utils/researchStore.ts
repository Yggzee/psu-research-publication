import { mockResearchers } from "../data/mockData";

export type UserRole = "admin" | "instructor";
export type ResearchStatus = "In Progress" | "Unpublished" | "Published";

export interface ManagedResearcher {
  lastName: string;
  firstName: string;
  name: string;
  instructorId: string;
  password: string;
  department: string;
  isFaculty: boolean;
  photoUrl?: string;
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
  ownerId: string;
  ownerName: string;
  source: "claim" | "manual" | "admin";
  approvalStatus: "pending" | "approved" | "rejected";
  researchStatus: ResearchStatus;
  isPublic: boolean;
  fileName?: string;
  createdAt: string;
}

export interface SessionUser {
  role: UserRole;
  instructorId?: string;
  name: string;
  department?: string;
}

export const FACULTY_DATA_KEY = "psu_faculty_data";
export const PUBLICATIONS_STORAGE_KEY = "psu_research_records";
export const SESSION_STORAGE_KEY = "psu_current_user";

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts.slice(0, -1).join(" ") || parts[0],
    lastName: parts.length > 1 ? parts[parts.length - 1] : "",
  };
}

export function getDefaultManagedResearchers(): ManagedResearcher[] {
  return mockResearchers.map((researcher, index) => {
    const { firstName, lastName } = splitName(researcher.name);
    return {
      firstName,
      lastName,
      name: researcher.name,
      instructorId: `PSU-${String(index + 1).padStart(3, "0")}`,
      password: "password",
      department: researcher.department,
      isFaculty: true,
    };
  });
}

export function getManagedResearchers(): ManagedResearcher[] {
  const stored = localStorage.getItem(FACULTY_DATA_KEY);
  if (!stored) return getDefaultManagedResearchers();

  try {
    const parsed = JSON.parse(stored) as Partial<ManagedResearcher>[];
    return parsed.map((member, index) => {
      const fallbackName = member.name || "Researcher";
      const split = splitName(fallbackName);
      const firstName = member.firstName || split.firstName;
      const lastName = member.lastName || split.lastName;
      return {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim(),
        instructorId: member.instructorId || `PSU-${String(index + 1).padStart(3, "0")}`,
        password: member.password || "password",
        department: member.department || "BSIT",
        isFaculty: member.isFaculty ?? true,
        photoUrl: member.photoUrl,
      };
    });
  } catch {
    return getDefaultManagedResearchers();
  }
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
}

export function updateResearchRecord(id: string, updates: Partial<StoredPublication>) {
  saveResearchRecords(
    getResearchRecords().map((record) =>
      record.id === id ? { ...record, ...updates } : record,
    ),
  );
}

export function getCurrentUser(): SessionUser {
  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // Use the admin fallback below.
  }
  return { role: "admin", name: "Admin User" };
}

export function setCurrentUser(user: SessionUser) {
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
}

export function clearCurrentUser() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}
