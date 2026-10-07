/**
 * Chart Utilities for Research Publication Tracking System
 * Handles dynamic year calculations and department color mapping
 */

// Department Color Mapping - Consistent across all charts
export const DEPARTMENT_COLORS = {
  BSIT: "#EAB308",    // Yellow
  BSBA: "#EC4899",    // Pink
  BSE: "#EF4444",     // Red
  BEE: "#3B82F6",     // Blue
  BIT: "#D1D5DB",     // Light Gray (labeled as White)
  BTLED: "#22C55E",   // Green
} as const;

export type Department = keyof typeof DEPARTMENT_COLORS;

export const DEPARTMENTS: Department[] = ["BSIT", "BSBA", "BEE", "BTLED", "BIT", "BSE"];

/**
 * Get the current year dynamically
 */
export function getCurrentYear(): number {
  return new Date().getFullYear();
}

/**
 * Get the last N years including the current year
 * @param count Number of years to retrieve (default: 5)
 * @returns Array of years from oldest to newest
 */
export function getLastNYears(count: number = 5): number[] {
  const currentYear = getCurrentYear();
  const years: number[] = [];
  for (let i = count - 1; i >= 0; i--) {
    years.push(currentYear - i);
  }
  return years;
}

/**
 * Get year range from a starting year to current year
 * @param startYear Starting year (e.g., 2015)
 * @returns Array of years from start to current
 */
export function getYearRange(startYear: number): number[] {
  const currentYear = getCurrentYear();
  const years: number[] = [];
  for (let year = startYear; year <= currentYear; year++) {
    years.push(year);
  }
  return years;
}

/**
 * Get a specific range of years
 * @param startYear Starting year
 * @param endYear Ending year
 * @returns Array of years
 */
export function getYearRangeCustom(startYear: number, endYear: number): number[] {
  const years: number[] = [];
  for (let year = startYear; year <= endYear; year++) {
    years.push(year);
  }
  return years;
}

/**
 * Shift year range backward by N years
 * @param currentStart Current start year
 * @param currentEnd Current end year
 * @param shift Number of years to shift (default: 5)
 * @param minYear Minimum allowed year (default: 2015)
 * @returns New year range [start, end]
 */
export function shiftYearRangeBackward(
  currentStart: number,
  currentEnd: number,
  shift: number = 5,
  minYear: number = 2015
): [number, number] {
  const newStart = Math.max(currentStart - shift, minYear);
  const newEnd = currentEnd - shift;
  return [newStart, newEnd];
}

/**
 * Shift year range forward by N years
 * @param currentStart Current start year
 * @param currentEnd Current end year
 * @param shift Number of years to shift (default: 5)
 * @returns New year range [start, end], capped at current year
 */
export function shiftYearRangeForward(
  currentStart: number,
  currentEnd: number,
  shift: number = 5
): [number, number] {
  const currentYear = getCurrentYear();
  const newStart = currentStart + shift;
  const newEnd = Math.min(currentEnd + shift, currentYear);
  return [newStart, newEnd];
}

/**
 * Component for rendering department legend
 */
export interface DepartmentLegendProps {
  departments?: Department[];
}

export const departmentLegendData = DEPARTMENTS.map((dept) => ({
  department: dept,
  color: DEPARTMENT_COLORS[dept],
  label: dept === "BIT" ? `${dept} (White)` : dept,
}));
