/**
 * Faculty Management Utilities
 * Handles faculty member filtering and validation
 */

const STORAGE_KEY = "psu_faculty_members";
const FACULTY_DATA_KEY = "psu_faculty_data";

export interface FacultyMember {
  name: string;
  department: string;
  isFaculty: boolean;
  photoUrl?: string;
}

/**
 * Get the full faculty data from localStorage
 */
export function getFacultyData(): FacultyMember[] {
  const stored = localStorage.getItem(FACULTY_DATA_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Get the current faculty list (names only) from localStorage
 */
export function getFacultyList(): string[] {
  const facultyData = getFacultyData();
  return facultyData.filter(f => f.isFaculty).map(f => f.name);
}

/**
 * Get faculty member data by name
 */
export function getFacultyMember(name: string): FacultyMember | undefined {
  const facultyData = getFacultyData();
  return facultyData.find(f => f.name === name);
}

/**
 * Check if a researcher is a faculty member
 */
export function isFacultyMember(researcherName: string): boolean {
  const facultyList = getFacultyList();
  return facultyList.includes(researcherName);
}

/**
 * Check if a publication has at least one faculty author (PSU Paper)
 */
export function hasFacultyAuthor(authors: string[]): boolean {
  const facultyList = getFacultyList();
  if (facultyList.length === 0) return false;

  return authors.some((author) => {
    const cleanAuthor = author.toLowerCase().trim();
    if (!cleanAuthor) return false;

    return facultyList.some((fac) => {
      const cleanFac = fac.toLowerCase().trim();
      // Exact match
      if (cleanAuthor === cleanFac || cleanAuthor.includes(cleanFac)) return true;

      // Smart academic name matching (e.g. "Julius Oscar Moreno" matches "OJC Moreno", "JO Moreno", "Moreno")
      const facParts = cleanFac.split(/\s+/).filter(Boolean);
      const lastName = facParts[facParts.length - 1];

      if (lastName && lastName.length > 2) {
        // Must contain the last name
        if (cleanAuthor.includes(lastName)) {
          // If single word author match or has matching initials
          const firstInitial = facParts[0]?.[0];
          if (!firstInitial || cleanAuthor.includes(firstInitial) || cleanAuthor === lastName) {
            return true;
          }
        }
      }

      return false;
    });
  });
}

/**
 * Determine if a publication is a PSU paper or Non-PSU paper
 */
export function isPSUPaper(authors: string[]): boolean {
  return hasFacultyAuthor(authors);
}

/**
 * Filter researchers to only include faculty members
 */
export function filterFacultyResearchers<T extends { name: string }>(
  researchers: T[]
): T[] {
  return researchers.filter((r) => {
    if (typeof (r as any).isFaculty === 'boolean') {
      return (r as any).isFaculty;
    }
    const facultyList = getFacultyList();
    if (facultyList.length === 0) return true;
    return facultyList.includes(r.name);
  });
}

/**
 * Filter publications to only include those with faculty authors (PSU papers)
 */
export function filterFacultyPublications<T extends { authors: string[] }>(
  publications: T[]
): T[] {
  const facultyList = getFacultyList();
  // If faculty list is empty, show all publications (default behavior)
  if (facultyList.length === 0) {
    return publications;
  }
  // Include publications that have a registered faculty author or are already marked approved
  return publications.filter(
    (pub) =>
      hasFacultyAuthor(pub.authors) ||
      (pub as any).approvalStatus === 'approved' ||
      (pub as any).approval_status === 'approved'
  );
}

/**
 * Get photo URL for a faculty member
 */
export function getFacultyPhoto(name: string): string | undefined {
  const member = getFacultyMember(name);
  return member?.photoUrl;
}

export interface AuthorCategory {
  name: string;
  isPsu: boolean;
}

/**
 * Categorize each author in an author array as PSU faculty vs Non-PSU collaborator
 */
export function categorizeAuthors(authors: string[]): AuthorCategory[] {
  const facultyList = getFacultyList();

  return authors.map((author) => {
    const cleanAuthor = author.toLowerCase().trim();
    if (!cleanAuthor) return { name: author, isPsu: false };

    const isMatch = facultyList.some((fac) => {
      const cleanFac = fac.toLowerCase().trim();
      if (cleanAuthor === cleanFac || cleanAuthor.includes(cleanFac)) return true;

      const facParts = cleanFac.split(/\s+/).filter(Boolean);
      const lastName = facParts[facParts.length - 1];
      if (lastName && lastName.length > 2 && cleanAuthor.includes(lastName)) {
        const firstInitial = facParts[0]?.[0];
        if (!firstInitial || cleanAuthor.includes(firstInitial) || cleanAuthor === lastName) {
          return true;
        }
      }
      return false;
    });

    return {
      name: author,
      isPsu: isMatch,
    };
  });
}

/**
 * Check if a publication has non-PSU co-authors (collaborative paper)
 */
export function hasExternalCollaborators(authors: string[]): boolean {
  const categorized = categorizeAuthors(authors);
  return categorized.some((a) => !a.isPsu);
}

/**
 * Normalize publication title to prevent duplicate saves and cross-reference search results
 */
export function normalizeTitle(t?: string | null): string {
  if (!t) return "";
  return t
    .replace(/^\[(pdf|html|c|b|citation|doc|book)\]\s*/i, "")
    .replace(/[’‘]/g, "'")
    .replace(/["“”]/g, "")
    .replace(/[…\.]+/g, "")
    .replace(/[^a-zA-Z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Check if a publication belongs to a specific researcher
 * Matches by owner ID, owner name, or academic author patterns
 */
export function matchesResearcher(p: any, r: any): boolean {
  if (!r) return false;
  const pOwnerId = (p.owner_id || p.ownerId || "").trim().toLowerCase();
  const rInstId = (r.instructor_id || r.instructorId || "").trim().toLowerCase();
  const rId = (r.id || "").trim().toLowerCase();
  if (pOwnerId && (pOwnerId === rInstId || pOwnerId === rId)) return true;

  const rName = (r.name || `${r.first_name || r.firstName || ""} ${r.last_name || r.lastName || ""}`).trim().toLowerCase();
  const rFirst = (r.first_name || r.firstName || r.name?.split(" ")[0] || "").trim().toLowerCase();
  const rLast = (r.last_name || r.lastName || r.name?.split(" ").slice(-1)[0] || "").trim().toLowerCase();
  const pOwnerName = (p.owner_name || p.ownerName || "").trim().toLowerCase();

  if (pOwnerName) {
    if (pOwnerName === rName) return true;
    if (rLast && rLast.length >= 3 && pOwnerName.includes(rLast)) return true;
  }

  let authors: any[] = [];
  try {
    authors = Array.isArray(p.authors) ? p.authors : JSON.parse(p.authors || "[]");
  } catch {
    authors = typeof p.authors === "string" ? p.authors.split(",") : [p.authors || ""];
  }

  for (const a of authors) {
    const aLower = (typeof a === "string" ? a : (a?.name || "")).trim().toLowerCase();
    if (!aLower) continue;
    if (aLower === rName || aLower.includes(rName) || rName.includes(aLower)) return true;
    if (rLast && rLast.length >= 3 && aLower.includes(rLast)) {
      const firstInitial = rFirst[0];
      if (!firstInitial || aLower.includes(firstInitial) || aLower.replace(/[^a-z]/g, "") === rLast) {
        return true;
      }
    }
  }

  return false;
}

export const publicationMatchesResearcher = matchesResearcher;

