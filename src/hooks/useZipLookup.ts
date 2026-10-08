import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { missingApplicantZips, withZipLocation, type ApplicantLocation, type ZipLocations } from "@/lib/applicantLocation";

export function useZipLookup(zips: string[]) {
  const normalized = [...new Set(zips.map((zip) => zip.trim()).filter(Boolean))].sort();
  return useQuery({
    queryKey: ["zip-lookup", normalized],
    enabled: normalized.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async (): Promise<ZipLocations> => {
      const { data, error } = await supabase.from("zip_codes").select("zip, city, state").in("zip", normalized);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((row) => [row.zip, { city: row.city, state: row.state }]));
    },
  });
}

/** One batch per staff view; never write ZIP fallbacks back to applicant records. */
const emptyLookup: ZipLocations = {};

export function useApplicantLocations(applicants: (ApplicantLocation | null | undefined)[]) {
  const { data: lookup = emptyLookup } = useZipLookup(missingApplicantZips(applicants));
  return useCallback(<T extends ApplicantLocation>(applicant: T): T => withZipLocation(applicant, lookup), [lookup]);
}