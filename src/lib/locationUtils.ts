/**
 * Address value structure from form builder address fields
 */
interface AddressValue {
  street?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
}

/**
 * Extract city and state from application answers JSONB.
 * Looks for AddressValue objects within the answers.
 */
export function getLocationFromAnswers(
  answers: Record<string, unknown> | null | undefined
): { city: string | null; state: string | null; address: string | null; zip: string | null } {
  if (!answers) return { city: null, state: null, address: null, zip: null };

  for (const value of Object.values(answers)) {
    if (typeof value === "object" && value !== null && "city" in value) {
      const addr = value as AddressValue;
      return {
        city: addr.city || null,
        state: addr.state || null,
        address: addr.street || null,
        zip: addr.zip || null,
      };
    }
  }
  return { city: null, state: null, address: null, zip: null };
}

/**
 * Get city with fallback to answers JSONB
 */
export function getCityWithFallback(
  applicantCity: string | null | undefined,
  answers: Record<string, unknown> | null | undefined
): string | null {
  if (applicantCity) return applicantCity;
  return getLocationFromAnswers(answers).city;
}

/**
 * Get state with fallback to answers JSONB
 */
export function getStateWithFallback(
  applicantState: string | null | undefined,
  answers: Record<string, unknown> | null | undefined
): string | null {
  if (applicantState) return applicantState;
  return getLocationFromAnswers(answers).state;
}
