export interface ApplicantLocation {
  city?: string | null;
  state?: string | null;
  home_zip?: string | null;
}

export type ZipLocations = Record<string, { city: string; state: string }>;

export function formatApplicantLocation(applicant: ApplicantLocation | null | undefined): string {
  const city = applicant?.city?.trim();
  const state = applicant?.state?.trim();
  const zip = applicant?.home_zip?.trim();
  if (city && state) return `${city}, ${state}${zip ? ` ${zip}` : ""}`;
  return zip || "—";
}

export function missingApplicantZips(applicants: (ApplicantLocation | null | undefined)[]): string[] {
  return [...new Set(applicants.flatMap((a) => {
    const zip = a?.home_zip?.trim();
    return zip && (!a?.city?.trim() || !a?.state?.trim()) ? [zip] : [];
  }))].sort();
}

export function withZipLocation<T extends ApplicantLocation>(applicant: T, lookup: ZipLocations): T {
  const fallback = lookup[applicant.home_zip?.trim() ?? ""];
  if (!fallback) return applicant;
  return {
    ...applicant,
    city: applicant.city?.trim() || fallback.city,
    state: applicant.state?.trim() || fallback.state,
  };
}