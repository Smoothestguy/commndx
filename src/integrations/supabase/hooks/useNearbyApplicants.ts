import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NearbyApplicant {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  home_zip: string | null;
  home_lat: number | null;
  home_lng: number | null;
  status: string | null;
  distance_mi: number | null;
  match_type: "distance" | "city" | "state" | "zip" | "none";
}

interface ProjectLoc {
  site_lat: number | null;
  site_lng: number | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

function haversineMi(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const useNearbyApplicants = (
  project: ProjectLoc | null | undefined,
  enabled = true
) => {
  return useQuery({
    queryKey: [
      "nearby-applicants",
      project?.site_lat,
      project?.site_lng,
      project?.city,
      project?.state,
      project?.zip,
    ],
    enabled: enabled && !!project,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applicants")
        .select(
          "id, first_name, last_name, phone, email, city, state, home_zip, home_lat, home_lng, status"
        )
        .not("phone", "is", null)
        .order("updated_at", { ascending: false })
        .limit(2000);

      if (error) throw error;

      const projLat = project?.site_lat ?? null;
      const projLng = project?.site_lng ?? null;
      const projCity = project?.city?.trim().toLowerCase() ?? "";
      const projState = project?.state?.trim().toLowerCase() ?? "";
      const projZip = project?.zip?.trim() ?? "";

      const results: NearbyApplicant[] = (data ?? []).map((a: any) => {
        let distance_mi: number | null = null;
        let match_type: NearbyApplicant["match_type"] = "none";

        if (
          projLat != null &&
          projLng != null &&
          a.home_lat != null &&
          a.home_lng != null
        ) {
          distance_mi = haversineMi(projLat, projLng, a.home_lat, a.home_lng);
          match_type = "distance";
        } else if (projZip && a.home_zip && a.home_zip.trim() === projZip) {
          match_type = "zip";
        } else if (
          projCity &&
          a.city &&
          a.city.trim().toLowerCase() === projCity
        ) {
          match_type = "city";
        } else if (
          projState &&
          a.state &&
          a.state.trim().toLowerCase() === projState
        ) {
          match_type = "state";
        }

        return { ...a, distance_mi, match_type };
      });

      // Sort: closest first, then city, zip, state, then none
      const rank: Record<NearbyApplicant["match_type"], number> = {
        distance: 0,
        zip: 1,
        city: 2,
        state: 3,
        none: 4,
      };
      results.sort((a, b) => {
        if (a.match_type !== b.match_type)
          return rank[a.match_type] - rank[b.match_type];
        if (a.distance_mi != null && b.distance_mi != null)
          return a.distance_mi - b.distance_mi;
        return 0;
      });

      return results;
    },
  });
};
