import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ActiveEntry {
  id: string;
  project_id: string;
  is_on_lunch: boolean;
  clock_blocked_until: string | null;
}

interface ProjectGeofence {
  require_clock_location: boolean;
  site_lat: number | null;
  site_lng: number | null;
  geofence_radius_miles: number;
}

const LOCATION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useLocationMonitor(
  activeEntry: ActiveEntry | null,
  projectGeofence: ProjectGeofence | null
) {
  const queryClient = useQueryClient();
  const { geoData, requestLocation } = useGeolocation(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const [lastLocation, setLastLocation] = useState<{ lat: number; lng: number } | null>(null);

  const sendLocationUpdate = useCallback(async () => {
    if (!activeEntry || !projectGeofence) return;

    // Skip if on lunch break
    if (activeEntry.is_on_lunch) {
      console.log("[LocationMonitor] Skipping update - on lunch break");
      return;
    }

    // Skip if location verification not required
    if (!projectGeofence.require_clock_location) {
      console.log("[LocationMonitor] Skipping update - location not required");
      return;
    }

    // Skip if no site coordinates
    if (!projectGeofence.site_lat || !projectGeofence.site_lng) {
      console.log("[LocationMonitor] Skipping update - no site coordinates");
      return;
    }

    // Request fresh location
    const freshGeoData = await requestLocation();

    // Check if we have valid coordinates
    if (!freshGeoData.lat || !freshGeoData.lng) {
      console.log("[LocationMonitor] No valid coordinates available");
      return;
    }

    // Throttle updates to prevent excessive calls
    const now = Date.now();
    if (now - lastUpdateRef.current < 30000) {
      console.log("[LocationMonitor] Throttling - too soon since last update");
      return;
    }
    lastUpdateRef.current = now;

    console.log("[LocationMonitor] Sending location update", {
      lat: freshGeoData.lat,
      lng: freshGeoData.lng,
      accuracy: freshGeoData.accuracy,
    });

    setLastLocation({ lat: freshGeoData.lat, lng: freshGeoData.lng });

    try {
      const { data, error } = await supabase.functions.invoke("update-clock-location", {
        body: {
          time_entry_id: activeEntry.id,
          lat: freshGeoData.lat,
          lng: freshGeoData.lng,
          accuracy: freshGeoData.accuracy,
        },
      });

      if (error) {
        console.error("[LocationMonitor] Error updating location:", error);
        return;
      }

      // Check if auto-clocked-out
      if (data?.auto_clocked_out) {
        toast.error("You've been clocked out because you left the job site", {
          duration: 10000,
          description: "Contact your administrator if you believe this was in error.",
        });

        // Invalidate queries to refresh UI
        queryClient.invalidateQueries({ queryKey: ["active-clock-entry"] });
        queryClient.invalidateQueries({ queryKey: ["time_entries"] });
      }
    } catch (err) {
      console.error("[LocationMonitor] Failed to send location update:", err);
    }
  }, [activeEntry, projectGeofence, requestLocation, queryClient]);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only monitor if:
    // 1. There's an active entry
    // 2. Not on lunch
    // 3. Location verification is required
    // 4. Site has coordinates
    const shouldMonitor =
      activeEntry &&
      !activeEntry.is_on_lunch &&
      !activeEntry.clock_blocked_until &&
      projectGeofence?.require_clock_location &&
      projectGeofence?.site_lat &&
      projectGeofence?.site_lng;

    if (!shouldMonitor) {
      console.log("[LocationMonitor] Not monitoring - conditions not met");
      return;
    }

    console.log("[LocationMonitor] Starting location monitoring");

    // Initial location update after a short delay
    const initialTimeout = setTimeout(() => {
      sendLocationUpdate();
    }, 5000);

    // Set up interval for periodic updates
    intervalRef.current = setInterval(() => {
      sendLocationUpdate();
    }, LOCATION_CHECK_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    activeEntry?.id,
    activeEntry?.is_on_lunch,
    activeEntry?.clock_blocked_until,
    projectGeofence?.require_clock_location,
    projectGeofence?.site_lat,
    projectGeofence?.site_lng,
    sendLocationUpdate,
  ]);

  return {
    isMonitoring: !!(
      activeEntry &&
      !activeEntry.is_on_lunch &&
      projectGeofence?.require_clock_location &&
      projectGeofence?.site_lat &&
      projectGeofence?.site_lng
    ),
    lastLocation,
  };
}
