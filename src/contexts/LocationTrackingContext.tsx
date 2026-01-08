import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { useNativeGeolocation } from "@/hooks/useNativeGeolocation";

interface LocationTrackingContextValue {
  isNative: boolean;
  isTrackingEnabled: boolean;
  hasLocationPermission: boolean | null;
  permissionStatus: "granted" | "denied" | "prompt" | "unknown";
  requestPermission: () => Promise<boolean>;
  checkPermission: () => Promise<void>;
  lastError: string | null;
}

const LocationTrackingContext = createContext<LocationTrackingContextValue | null>(null);

export function useLocationTracking() {
  const context = useContext(LocationTrackingContext);
  if (!context) {
    throw new Error("useLocationTracking must be used within LocationTrackingProvider");
  }
  return context;
}

interface LocationTrackingProviderProps {
  children: React.ReactNode;
}

export function LocationTrackingProvider({ children }: LocationTrackingProviderProps) {
  const isNative = Capacitor.isNativePlatform();
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<"granted" | "denied" | "prompt" | "unknown">("unknown");
  const [lastError, setLastError] = useState<string | null>(null);

  const { startTracking, stopTracking, error: geoError } = useNativeGeolocation();

  // Check permission status
  const checkPermission = useCallback(async () => {
    if (isNative) {
      try {
        const { BackgroundGeolocation } = await import(
          "@transistorsoft/capacitor-background-geolocation"
        );
        
        const status = await BackgroundGeolocation.getProviderState();
        
        // Check if location services are enabled and we have permission
        const hasPermission = status.enabled && status.status >= 3; // 3 = authorized always
        setHasLocationPermission(hasPermission);
        
        if (status.status === 4) {
          setPermissionStatus("granted"); // Always
        } else if (status.status === 3) {
          setPermissionStatus("granted"); // When in use
        } else if (status.status === 2) {
          setPermissionStatus("denied");
        } else {
          setPermissionStatus("prompt");
        }
      } catch (err) {
        console.error("[LocationTracking] Failed to check permission:", err);
        setPermissionStatus("unknown");
      }
    } else {
      // Web - check navigator.permissions if available
      if ("permissions" in navigator) {
        try {
          const result = await navigator.permissions.query({ name: "geolocation" });
          setPermissionStatus(result.state as "granted" | "denied" | "prompt");
          setHasLocationPermission(result.state === "granted");
        } catch {
          setPermissionStatus("unknown");
        }
      }
    }
  }, [isNative]);

  // Request permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    setLastError(null);

    if (isNative) {
      try {
        const { BackgroundGeolocation } = await import(
          "@transistorsoft/capacitor-background-geolocation"
        );

        // Request permission through the plugin
        const status = await BackgroundGeolocation.requestPermission();
        
        const hasPermission = status === 3 || status === 4; // WhenInUse or Always
        setHasLocationPermission(hasPermission);
        setPermissionStatus(hasPermission ? "granted" : "denied");
        
        return hasPermission;
      } catch (err: any) {
        console.error("[LocationTracking] Failed to request permission:", err);
        setLastError(err.message || "Failed to request location permission");
        return false;
      }
    } else {
      // Web - trigger permission prompt via getCurrentPosition
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            setHasLocationPermission(true);
            setPermissionStatus("granted");
            resolve(true);
          },
          (err) => {
            setHasLocationPermission(false);
            setPermissionStatus("denied");
            setLastError(err.message);
            resolve(false);
          },
          { enableHighAccuracy: true }
        );
      });
    }
  }, [isNative]);

  // Check permission on mount
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  // Update error from geolocation hook
  useEffect(() => {
    if (geoError) {
      setLastError(geoError);
    }
  }, [geoError]);

  const value: LocationTrackingContextValue = {
    isNative,
    isTrackingEnabled: hasLocationPermission === true,
    hasLocationPermission,
    permissionStatus,
    requestPermission,
    checkPermission,
    lastError,
  };

  return (
    <LocationTrackingContext.Provider value={value}>
      {children}
    </LocationTrackingContext.Provider>
  );
}

