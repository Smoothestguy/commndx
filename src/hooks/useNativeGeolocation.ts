import { useState, useCallback, useRef, useEffect } from "react";
import { Capacitor } from "@capacitor/core";

// Types for background geolocation
interface GeofenceConfig {
  identifier: string;
  radius: number; // in meters
  latitude: number;
  longitude: number;
  notifyOnEntry?: boolean;
  notifyOnExit?: boolean;
  notifyOnDwell?: boolean;
}

interface LocationData {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: string | null;
  source: "native" | "web" | null;
}

interface UseNativeGeolocationReturn {
  isNative: boolean;
  isTracking: boolean;
  lastLocation: LocationData | null;
  error: string | null;
  startTracking: () => Promise<boolean>;
  stopTracking: () => Promise<void>;
  getCurrentLocation: () => Promise<LocationData>;
  addGeofence: (config: GeofenceConfig) => Promise<void>;
  removeGeofence: (identifier: string) => Promise<void>;
  removeAllGeofences: () => Promise<void>;
}

const initialLocationData: LocationData = {
  lat: null,
  lng: null,
  accuracy: null,
  speed: null,
  heading: null,
  timestamp: null,
  source: null,
};

export function useNativeGeolocation(
  onGeofenceExit?: (identifier: string) => void
): UseNativeGeolocationReturn {
  const isNative = Capacitor.isNativePlatform();
  const [isTracking, setIsTracking] = useState(false);
  const [lastLocation, setLastLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Store the BackgroundGeolocation module reference
  const bgGeoRef = useRef<any>(null);
  const geofenceListenerRef = useRef<any>(null);

  // Load the native plugin dynamically (only on native platforms)
  const loadNativePlugin = useCallback(async () => {
    if (!isNative || bgGeoRef.current) return bgGeoRef.current;

    try {
      const { BackgroundGeolocation } = await import(
        "@transistorsoft/capacitor-background-geolocation"
      );
      bgGeoRef.current = BackgroundGeolocation;
      return BackgroundGeolocation;
    } catch (err) {
      console.error("[NativeGeo] Failed to load BackgroundGeolocation:", err);
      setError("Failed to load native geolocation plugin");
      return null;
    }
  }, [isNative]);

  // Start background location tracking
  const startTracking = useCallback(async (): Promise<boolean> => {
    setError(null);

    if (isNative) {
      const BackgroundGeolocation = await loadNativePlugin();
      if (!BackgroundGeolocation) return false;

      try {
        // Configure the plugin
        await BackgroundGeolocation.ready({
          // Geolocation config
          desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
          distanceFilter: 50, // meters

          // Activity recognition
          stopTimeout: 5, // minutes to wait before turning off GPS after motion stops

          // Application config
          stopOnTerminate: false, // Keep tracking when app is terminated
          startOnBoot: true, // Auto-start on device boot

          // HTTP/Persistence config (we handle sync ourselves)
          autoSync: false,

          // Geofencing
          geofenceModeHighAccuracy: true,

          // iOS-specific
          preventSuspend: true,

          // Android-specific
          notification: {
            title: "Command X",
            text: "Tracking your location for time clock",
            channelName: "Location Tracking",
          },
          foregroundService: true,
        });

        // Set up location listener
        BackgroundGeolocation.onLocation((location: any) => {
          setLastLocation({
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            accuracy: location.coords.accuracy,
            speed: location.coords.speed,
            heading: location.coords.heading,
            timestamp: location.timestamp,
            source: "native",
          });
        });

        // Set up geofence listener
        if (onGeofenceExit) {
          geofenceListenerRef.current = BackgroundGeolocation.onGeofence(
            (event: any) => {
              console.log("[NativeGeo] Geofence event:", event);
              if (event.action === "EXIT") {
                onGeofenceExit(event.identifier);
              }
            }
          );
        }

        // Start tracking
        await BackgroundGeolocation.start();
        setIsTracking(true);
        return true;
      } catch (err: any) {
        console.error("[NativeGeo] Failed to start tracking:", err);
        setError(err.message || "Failed to start location tracking");
        return false;
      }
    } else {
      // Web fallback - just set tracking state, actual tracking handled by useGeolocation
      setIsTracking(true);
      return true;
    }
  }, [isNative, loadNativePlugin, onGeofenceExit]);

  // Stop tracking
  const stopTracking = useCallback(async (): Promise<void> => {
    if (isNative && bgGeoRef.current) {
      try {
        await bgGeoRef.current.stop();
        if (geofenceListenerRef.current) {
          geofenceListenerRef.current.remove();
          geofenceListenerRef.current = null;
        }
      } catch (err) {
        console.error("[NativeGeo] Failed to stop tracking:", err);
      }
    }
    setIsTracking(false);
  }, [isNative]);

  // Get current location (one-time)
  const getCurrentLocation = useCallback(async (): Promise<LocationData> => {
    setError(null);

    if (isNative) {
      const BackgroundGeolocation = await loadNativePlugin();
      if (!BackgroundGeolocation) return initialLocationData;

      try {
        const location = await BackgroundGeolocation.getCurrentPosition({
          timeout: 30,
          maximumAge: 5000,
          desiredAccuracy: 10,
        });

        const locationData: LocationData = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          accuracy: location.coords.accuracy,
          speed: location.coords.speed,
          heading: location.coords.heading,
          timestamp: location.timestamp,
          source: "native",
        };

        setLastLocation(locationData);
        return locationData;
      } catch (err: any) {
        console.error("[NativeGeo] Failed to get location:", err);
        setError(err.message || "Failed to get location");
        return initialLocationData;
      }
    } else {
      // Web fallback
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          setError("Geolocation not supported");
          resolve(initialLocationData);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const locationData: LocationData = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              speed: position.coords.speed,
              heading: position.coords.heading,
              timestamp: new Date().toISOString(),
              source: "web",
            };
            setLastLocation(locationData);
            resolve(locationData);
          },
          (err) => {
            setError(err.message);
            resolve(initialLocationData);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
        );
      });
    }
  }, [isNative, loadNativePlugin]);

  // Add a geofence
  const addGeofence = useCallback(
    async (config: GeofenceConfig): Promise<void> => {
      if (!isNative) {
        console.log("[NativeGeo] Geofencing not available on web");
        return;
      }

      const BackgroundGeolocation = await loadNativePlugin();
      if (!BackgroundGeolocation) return;

      try {
        await BackgroundGeolocation.addGeofence({
          identifier: config.identifier,
          radius: config.radius,
          latitude: config.latitude,
          longitude: config.longitude,
          notifyOnEntry: config.notifyOnEntry ?? false,
          notifyOnExit: config.notifyOnExit ?? true,
          notifyOnDwell: config.notifyOnDwell ?? false,
        });
        console.log("[NativeGeo] Geofence added:", config.identifier);
      } catch (err: any) {
        console.error("[NativeGeo] Failed to add geofence:", err);
        setError(err.message || "Failed to add geofence");
      }
    },
    [isNative, loadNativePlugin]
  );

  // Remove a geofence
  const removeGeofence = useCallback(
    async (identifier: string): Promise<void> => {
      if (!isNative || !bgGeoRef.current) return;

      try {
        await bgGeoRef.current.removeGeofence(identifier);
        console.log("[NativeGeo] Geofence removed:", identifier);
      } catch (err: any) {
        console.error("[NativeGeo] Failed to remove geofence:", err);
      }
    },
    [isNative]
  );

  // Remove all geofences
  const removeAllGeofences = useCallback(async (): Promise<void> => {
    if (!isNative || !bgGeoRef.current) return;

    try {
      await bgGeoRef.current.removeGeofences();
      console.log("[NativeGeo] All geofences removed");
    } catch (err: any) {
      console.error("[NativeGeo] Failed to remove geofences:", err);
    }
  }, [isNative]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (geofenceListenerRef.current) {
        geofenceListenerRef.current.remove();
      }
    };
  }, []);

  return {
    isNative,
    isTracking,
    lastLocation,
    error,
    startTracking,
    stopTracking,
    getCurrentLocation,
    addGeofence,
    removeGeofence,
    removeAllGeofences,
  };
}
