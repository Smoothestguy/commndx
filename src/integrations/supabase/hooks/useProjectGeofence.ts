import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProjectGeofence {
  id: string;
  name: string;
  site_lat: number | null;
  site_lng: number | null;
  site_geocoded_at: string | null;
  geofence_radius_miles: number;
  require_clock_location: boolean;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

export function useProjectGeofence(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-geofence", projectId],
    queryFn: async () => {
      if (!projectId) return null;

      const { data, error } = await supabase
        .from("projects")
        .select(`
          id,
          name,
          site_lat,
          site_lng,
          site_geocoded_at,
          geofence_radius_miles,
          require_clock_location,
          address,
          city,
          state,
          zip
        `)
        .eq("id", projectId)
        .single();

      if (error) throw error;
      return data as ProjectGeofence;
    },
    enabled: !!projectId,
  });
}

export function useGeocodeProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      // First get the project address
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("address, city, state, zip")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;

      if (!project.address) {
        throw new Error("Project has no address to geocode");
      }

      const fullAddress = [project.address, project.city, project.state, project.zip]
        .filter(Boolean)
        .join(", ");

      // Call the geocode edge function
      const { data, error } = await supabase.functions.invoke("geocode", {
        body: { address: fullAddress },
      });

      if (error) throw error;
      if (!data.success || !data.lat || !data.lng) {
        throw new Error(data.error || "Failed to geocode address");
      }

      // Update the project with coordinates
      const { error: updateError } = await supabase
        .from("projects")
        .update({
          site_lat: data.lat,
          site_lng: data.lng,
          site_geocoded_at: new Date().toISOString(),
        })
        .eq("id", projectId);

      if (updateError) throw updateError;

      return { lat: data.lat, lng: data.lng };
    },
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: ["project-geofence", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Project location geocoded successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to geocode project: " + error.message);
    },
  });
}

export function useUpdateProjectGeofence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      geofenceRadiusMiles,
      requireClockLocation,
    }: {
      projectId: string;
      geofenceRadiusMiles?: number;
      requireClockLocation?: boolean;
    }) => {
      const updates: Record<string, unknown> = {};
      if (geofenceRadiusMiles !== undefined) {
        updates.geofence_radius_miles = geofenceRadiusMiles;
      }
      if (requireClockLocation !== undefined) {
        updates.require_clock_location = requireClockLocation;
      }

      const { error } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", projectId);

      if (error) throw error;
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ["project-geofence", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Geofence settings updated");
    },
    onError: (error: Error) => {
      toast.error("Failed to update geofence: " + error.message);
    },
  });
}
