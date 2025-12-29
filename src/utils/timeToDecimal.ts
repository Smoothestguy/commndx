/**
 * Time-to-Decimal Converter Utilities
 * 
 * Converts various time input formats to decimal hours for accurate payroll calculations.
 * Examples:
 *   - "8:20" → 8.33 hours (8 hours 20 minutes)
 *   - "820" → 8.33 hours
 *   - "8" → 8.00 hours
 *   - "7.5" → 7.50 hours (already decimal)
 */

export interface TimeParseResult {
  hours: number;
  minutes: number;
  decimalHours: number;
  isValid: boolean;
  error?: string;
}

/**
 * Parse time input string and convert to decimal hours.
 * Accepts multiple formats:
 * - "8:20" or "8.20" (time format) → 8.33 hours
 * - "820" (3-4 digit shorthand) → 8.33 hours
 * - "8" (single/double digit) → 8.00 hours
 * - "8.5" (already decimal) → 8.50 hours
 */
export function parseTimeToDecimal(input: string): TimeParseResult {
  if (!input || input.trim() === "") {
    return { hours: 0, minutes: 0, decimalHours: 0, isValid: true };
  }

  // Clean the input: trim whitespace
  let cleaned = input.trim();

  // Check if it's already a simple decimal number (e.g., "8.5", "7.25")
  // A decimal number has exactly one dot and digits on both sides
  const decimalMatch = cleaned.match(/^(\d+)\.(\d+)$/);
  if (decimalMatch) {
    const decimalValue = parseFloat(cleaned);
    // If the decimal part suggests it's already decimal hours (not minutes)
    // e.g., 8.5 = 8.5 hours, 8.33 = 8.33 hours
    if (decimalValue >= 0 && decimalValue <= 24) {
      const hours = Math.floor(decimalValue);
      const fractionalPart = decimalValue - hours;
      const minutes = Math.round(fractionalPart * 60);
      return {
        hours,
        minutes,
        decimalHours: Math.round(decimalValue * 100) / 100,
        isValid: true,
      };
    }
    return { hours: 0, minutes: 0, decimalHours: 0, isValid: false, error: "Hours cannot exceed 24" };
  }

  // Remove colons and dots for time parsing
  cleaned = cleaned.replace(/[:.]/g, "");

  // Check if it's just digits
  if (!/^\d+$/.test(cleaned)) {
    return { hours: 0, minutes: 0, decimalHours: 0, isValid: false, error: "Invalid format" };
  }

  let hours = 0;
  let minutes = 0;

  const len = cleaned.length;

  if (len === 1 || len === 2) {
    // Single or double digit: interpret as whole hours (1-24)
    hours = parseInt(cleaned, 10);
    minutes = 0;
  } else if (len === 3) {
    // 3 digits: first digit is hours, last two are minutes (e.g., "820" → 8:20)
    hours = parseInt(cleaned[0], 10);
    minutes = parseInt(cleaned.slice(1), 10);
  } else if (len === 4) {
    // 4 digits: first two are hours, last two are minutes (e.g., "0820" → 08:20, "1230" → 12:30)
    hours = parseInt(cleaned.slice(0, 2), 10);
    minutes = parseInt(cleaned.slice(2), 10);
  } else {
    return { hours: 0, minutes: 0, decimalHours: 0, isValid: false, error: "Invalid format" };
  }

  // Validate hours and minutes
  if (hours < 0 || hours > 24) {
    return { hours: 0, minutes: 0, decimalHours: 0, isValid: false, error: "Hours must be 0-24" };
  }
  if (minutes < 0 || minutes > 59) {
    return { hours: 0, minutes: 0, decimalHours: 0, isValid: false, error: "Minutes must be 0-59" };
  }

  // Calculate decimal hours
  const decimalHours = Math.round((hours + minutes / 60) * 100) / 100;

  if (decimalHours > 24) {
    return { hours: 0, minutes: 0, decimalHours: 0, isValid: false, error: "Total cannot exceed 24 hours" };
  }

  return { hours, minutes, decimalHours, isValid: true };
}

/**
 * Convert decimal hours back to time format string (e.g., 8.33 → "8:20")
 */
export function formatDecimalAsTime(decimal: number): string {
  if (!decimal || decimal <= 0) return "0:00";
  
  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal - hours) * 60);
  
  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

/**
 * Format decimal hours with both formats (e.g., "8:20 = 8.33 hrs")
 */
export function formatTimeWithDecimal(decimal: number): string {
  if (!decimal || decimal <= 0) return "";
  
  const timeFormat = formatDecimalAsTime(decimal);
  const decimalRounded = Math.round(decimal * 100) / 100;
  
  return `${timeFormat} = ${decimalRounded.toFixed(2)} hrs`;
}

/**
 * Get a preview string for live conversion display
 */
export function getConversionPreview(input: string): string | null {
  if (!input || input.trim() === "") return null;
  
  const result = parseTimeToDecimal(input);
  
  if (!result.isValid) {
    return result.error || "Invalid";
  }
  
  if (result.decimalHours === 0) return null;
  
  // Only show preview if input looks like time format (has colon or is 3-4 digits without decimal)
  const cleaned = input.trim().replace(/[:.]/g, "");
  const isTimeFormat = input.includes(":") || (cleaned.length >= 3 && !input.includes("."));
  
  if (isTimeFormat) {
    return `= ${result.decimalHours.toFixed(2)} hrs`;
  }
  
  return null;
}
