import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Loader2, AlertTriangle } from "lucide-react";
import { useClockIn, useClockOut, useOpenClockEntry, formatTime24h } from "@/integrations/supabase/hooks/useTimeClock";
import { useGeolocation } from "@/hooks/useGeolocation";
import { toast } from "sonner";
import { LocationPermissionDialog } from "./LocationPermissionDialog";

interface InlineClockControlsProps {
  project: {
    id: string;
    name: string;
    require_clock_location?: boolean;
  };
  personnelId: string;
  hasOtherOpenEntry: boolean;
}

export function InlineClockControls({ project, personnelId, hasOtherOpenEntry }: InlineClockControlsProps) {
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  
  const { data: openEntry, isLoading } = useOpenClockEntry(personnelId, project.id);
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const { geoData, isRequesting, permissionState, requestLocation, hasLocation } = useGeolocation(false);

  const requiresLocation = project.require_clock_location !== false;
  const isLocationDenied = permissionState === "denied";
  const isLocationPrompt = permissionState === "prompt" || permissionState === null;

  const getLocation = (): Promise<{
    lat: number | null;
    lng: number | null;
    accuracy: number | null;
    source: "device" | "ip_fallback" | null;
    capturedAt: string | null;
    error: string | null;
  }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: null, lng: null, accuracy: null, source: null, capturedAt: null, error: "Geolocation not supported" });
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            source: "device",
            capturedAt: new Date().toISOString(),
            error: null,
          });
        },
        (err) => resolve({ lat: null, lng: null, accuracy: null, source: null, capturedAt: null, error: err.message }),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const handleClockIn = async () => {
    if (hasOtherOpenEntry) {
      toast.error("Already clocked into another project. Clock out first.");
      return;
    }

    // If location is required and denied, show the assistance dialog
    if (requiresLocation && isLocationDenied) {
      setShowLocationDialog(true);
      return;
    }

    setIsGettingLocation(true);
    const locationData = await getLocation();
    
    if (requiresLocation && !locationData.lat) {
      setIsGettingLocation(false);
      // Show dialog for assistance
      setShowLocationDialog(true);
      return;
    }
    
    setIsGettingLocation(false);

    clockIn.mutate({
      personnelId,
      projectId: project.id,
      geoData: locationData,
    });
  };

  const handleClockOut = async () => {
    if (!openEntry) return;

    setIsGettingLocation(true);
    const locationData = await getLocation();
    setIsGettingLocation(false);

    clockOut.mutate({
      entryId: openEntry.id,
      personnelId,
      projectId: project.id,
      clockInAt: openEntry.clock_in_at!,
      geoData: locationData,
    });
  };

  const handleLocationDialogRequest = () => {
    requestLocation();
  };

  const isPending = clockIn.isPending || clockOut.isPending || isGettingLocation;

  if (isLoading) {
    return (
      <div className="mt-2 p-2 bg-secondary/30 rounded flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading...
      </div>
    );
  }

  return (
    <>
      <div className="mt-2 p-2 bg-secondary/30 rounded">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            {openEntry ? (
              <span className="text-green-600 dark:text-green-400 font-medium">
                Clocked in at {formatTime24h(openEntry.clock_in_at!)}
              </span>
            ) : (
              <span className="text-muted-foreground">Not clocked in</span>
            )}
          </div>
          
          {openEntry ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleClockOut();
              }}
              disabled={isPending}
              className="h-7 text-xs"
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Clock Out"}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleClockIn();
              }}
              disabled={isPending || hasOtherOpenEntry}
              className="h-7 text-xs"
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Clock In"}
            </Button>
          )}
        </div>
        
        {requiresLocation && (
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {openEntry?.clock_in_lat ? "Location captured" : "Location required"}
            </div>
            
            {/* Show warning and enable button if location is denied */}
            {!openEntry && isLocationDenied && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLocationDialog(true);
                }}
                className="flex items-center gap-1 text-xs text-destructive hover:underline"
              >
                <AlertTriangle className="h-3 w-3" />
                Enable Location
              </button>
            )}
          </div>
        )}
      </div>

      <LocationPermissionDialog
        open={showLocationDialog}
        onOpenChange={setShowLocationDialog}
      />
    </>
  );
}