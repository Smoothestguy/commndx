import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useNativeGeolocation } from "@/hooks/useNativeGeolocation";
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
const MILES_TO_METERS = 1609.34;

export function useLocationMonitor(
  activeEntry: ActiveEntry | null,
  projectGeofence: ProjectGeofence | null
) {
  const queryClient = useQueryClient();
  const { requestLocation } = useGeolocation(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const [lastLocation, setLastLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const geofenceAddedRef = useRef<string | null>(null);

  // Handle native geofence exit - auto clock out
  const handleGeofenceExit = useCallback(
    async (identifier: string) => {
      console.log("[LocationMonitor] Geofence EXIT detected:", identifier);

      // Extract project ID from identifier
      const projectId = identifier.replace("project-", "");

      // Verify this is the active project
      if (!activeEntry || activeEntry.project_id !== projectId) {
        console.log(
          "[LocationMonitor] Geofence exit for non-active project, ignoring"
        );
        return;
      }

      // Skip if on lunch
      if (activeEntry.is_on_lunch) {
        console.log("[LocationMonitor] On lunch break, ignoring geofence exit");
        return;
      }

      // Trigger auto-clock-out via the server
      try {
        const { data, error } = await supabase.functions.invoke(
          "update-clock-location",
          {
            body: {
              time_entry_id: activeEntry.id,
              lat: 0, // Will trigger out-of-range check
              lng: 0,
              accuracy: 0,
              geofence_exit: true, // Flag to indicate this is a geofence exit
            },
          }
        );

        if (error) {
          console.error("[LocationMonitor] Error on geofence exit:", error);
          return;
        }

        if (data?.auto_clocked_out) {
          toast.error("You've been clocked out because you left the job site", {
            duration: 10000,
            description:
              "Contact your administrator if you believe this was in error.",
          });

          queryClient.invalidateQueries({ queryKey: ["active-clock-entry"] });
          queryClient.invalidateQueries({
            queryKey: ["all-open-clock-entries"],
          });
          queryClient.invalidateQueries({ queryKey: ["time_entries"] });
        }
      } catch (err) {
        console.error("[LocationMonitor] Failed to handle geofence exit:", err);
      }
    },
    [activeEntry, queryClient]
  );

  // Initialize native geolocation with geofence handler
  const {
    isNative,
    isTracking: isNativeTracking,
    startTracking: startNativeTracking,
    stopTracking: stopNativeTracking,
    getCurrentLocation: getNativeLocation,
    addGeofence,
    removeGeofence,
    removeAllGeofences,
  } = useNativeGeolocation(handleGeofenceExit);

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

    // Request fresh location - use native on mobile, web API on browser
    let lat: number | null = null;
    let lng: number | null = null;
    let accuracy: number | null = null;

    if (isNative) {
      const nativeLocation = await getNativeLocation();
      lat = nativeLocation.lat;
      lng = nativeLocation.lng;
      accuracy = nativeLocation.accuracy;
    } else {
      const freshGeoData = await requestLocation();
      lat = freshGeoData.lat;
      lng = freshGeoData.lng;
      accuracy = freshGeoData.accuracy;
    }

    // Check if we have valid coordinates
    if (!lat || !lng) {
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
      lat,
      lng,
      accuracy,
      source: isNative ? "native" : "web",
    });

    setLastLocation({ lat, lng });

    try {
      const { data, error } = await supabase.functions.invoke(
        "update-clock-location",
        {
          body: {
            time_entry_id: activeEntry.id,
            lat,
            lng,
            accuracy,
          },
        }
      );

      if (error) {
        console.error("[LocationMonitor] Error updating location:", error);
        return;
      }

      // Check if auto-clocked-out
      if (data?.auto_clocked_out) {
        toast.error("You've been clocked out because you left the job site", {
          duration: 10000,
          description:
            "Contact your administrator if you believe this was in error.",
        });

        // Invalidate queries to refresh UI
        queryClient.invalidateQueries({ queryKey: ["active-clock-entry"] });
        queryClient.invalidateQueries({ queryKey: ["all-open-clock-entries"] });
        queryClient.invalidateQueries({ queryKey: ["time_entries"] });
      }
    } catch (err) {
      console.error("[LocationMonitor] Failed to send location update:", err);
    }
  }, [
    activeEntry,
    projectGeofence,
    requestLocation,
    getNativeLocation,
    isNative,
    queryClient,
  ]);

  // Effect to manage native geofencing
  useEffect(() => {
    const setupNativeGeofence = async () => {
      if (!isNative || !activeEntry || !projectGeofence) return;

      // Only set up geofence if location is required and site has coordinates
      if (
        !projectGeofence.require_clock_location ||
        !projectGeofence.site_lat ||
        !projectGeofence.site_lng
      ) {
        // Remove any existing geofence
        if (geofenceAddedRef.current) {
          await removeGeofence(geofenceAddedRef.current);
          geofenceAddedRef.current = null;
        }
        return;
      }

      // Skip if on lunch - pause geofencing
      if (activeEntry.is_on_lunch) {
        console.log("[LocationMonitor] On lunch - pausing geofence monitoring");
        if (geofenceAddedRef.current) {
          await removeGeofence(geofenceAddedRef.current);
          geofenceAddedRef.current = null;
        }
        return;
      }

      const geofenceId = `project-${activeEntry.project_id}`;

      // Only add if not already added for this project
      if (geofenceAddedRef.current !== geofenceId) {
        // Remove old geofence if exists
        if (geofenceAddedRef.current) {
          await removeGeofence(geofenceAddedRef.current);
        }

        // Start native tracking
        await startNativeTracking();

        // Add new geofence
        await addGeofence({
          identifier: geofenceId,
          latitude: projectGeofence.site_lat,
          longitude: projectGeofence.site_lng,
          radius: projectGeofence.geofence_radius_miles * MILES_TO_METERS,
          notifyOnExit: true,
          notifyOnEntry: false,
        });

        geofenceAddedRef.current = geofenceId;
        console.log("[LocationMonitor] Native geofence added:", geofenceId);
      }
    };

    setupNativeGeofence();

    // Cleanup when conditions change
    return () => {
      if (isNative && geofenceAddedRef.current && !activeEntry) {
        // Entry ended, clean up
        removeGeofence(geofenceAddedRef.current);
        geofenceAddedRef.current = null;
        stopNativeTracking();
      }
    };
  }, [
    isNative,
    activeEntry?.id,
    activeEntry?.project_id,
    activeEntry?.is_on_lunch,
    projectGeofence?.require_clock_location,
    projectGeofence?.site_lat,
    projectGeofence?.site_lng,
    projectGeofence?.geofence_radius_miles,
    addGeofence,
    removeGeofence,
    startNativeTracking,
    stopNativeTracking,
  ]);

  // Effect for web-based polling (fallback for browsers)
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

    console.log("[LocationMonitor] Starting location monitoring", {
      mode: isNative ? "native (geofence + polling)" : "web (polling only)",
    });

    // Initial location update after a short delay
    const initialTimeout = setTimeout(() => {
      sendLocationUpdate();
    }, 5000);

    // Set up interval for periodic updates
    // On native, this is less critical since geofencing handles exit detection
    // But we still poll to update the server with current location
    intervalRef.current = setInterval(() => {
      sendLocationUpdate();
    }, LOCATION_CHECK_INTERVAL);

    // Visibility change handler - send update when user returns to tab (web only)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && shouldMonitor) {
        console.log(
          "[LocationMonitor] Tab became visible - sending location update"
        );
        setTimeout(() => {
          sendLocationUpdate();
        }, 1000);
      }
    };

    // Only add web-specific listeners when not native
    if (!isNative) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (!isNative) {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        );
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
    isNative,
  ]);

  return {
    isMonitoring: !!(
      activeEntry &&
      !activeEntry.is_on_lunch &&
      projectGeofence?.require_clock_location &&
      projectGeofence?.site_lat &&
      projectGeofence?.site_lng
    ),
    isNative,
    isNativeTracking,
    lastLocation,
  };
}
