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
  const facultyList = getFacultyList();
  // If faculty list is empty, show all researchers (default behavior)
  if (facultyList.length === 0) {
    return researchers;
  }
  return researchers.filter(r => facultyList.includes(r.name));
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
  return publications.filter(pub => hasFacultyAuthor(pub.authors));
}

/**
 * Get photo URL for a faculty member
 */
export function getFacultyPhoto(name: string): string | undefined {
  const member = getFacultyMember(name);
  return member?.photoUrl;
}
