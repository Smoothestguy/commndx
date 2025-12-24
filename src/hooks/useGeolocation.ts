import { useState, useEffect, useCallback } from "react";

export interface GeoData {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  source: "device" | "ip_fallback" | null;
  capturedAt: string | null;
  error: string | null;
}

const initialGeoData: GeoData = {
  lat: null,
  lng: null,
  accuracy: null,
  source: null,
  capturedAt: null,
  error: null,
};

export function useGeolocation(autoRequest: boolean = true) {
  const [geoData, setGeoData] = useState<GeoData>(initialGeoData);
  const [isRequesting, setIsRequesting] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState | null>(null);

  const requestLocation = useCallback((): Promise<GeoData> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        const errorData: GeoData = {
          ...initialGeoData,
          error: "Geolocation is not supported by this browser",
        };
        setGeoData(errorData);
        resolve(errorData);
        return;
      }

      setIsRequesting(true);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const successData: GeoData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            source: "device",
            capturedAt: new Date().toISOString(),
            error: null,
          };
          setGeoData(successData);
          setIsRequesting(false);
          resolve(successData);
        },
        (error) => {
          let errorMessage: string;
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Location permission denied";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location information unavailable";
              break;
            case error.TIMEOUT:
              errorMessage = "Location request timed out";
              break;
            default:
              errorMessage = "Unknown location error";
          }
          const errorData: GeoData = {
            ...initialGeoData,
            error: errorMessage,
          };
          setGeoData(errorData);
          setIsRequesting(false);
          resolve(errorData);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000, // Cache for 1 minute
        }
      );
    });
  }, []);

  // Check permission state
  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((result) => {
          setPermissionState(result.state);
          result.addEventListener("change", () => {
            setPermissionState(result.state);
          });
        })
        .catch(() => {
          // Permissions API not fully supported
          setPermissionState(null);
        });
    }
  }, []);

  // Auto-request on mount if enabled
  useEffect(() => {
    if (autoRequest) {
      requestLocation();
    }
  }, [autoRequest, requestLocation]);

  const hasLocation = geoData.lat !== null && geoData.lng !== null;

  return {
    geoData,
    isRequesting,
    permissionState,
    requestLocation,
    hasLocation,
  };
}
