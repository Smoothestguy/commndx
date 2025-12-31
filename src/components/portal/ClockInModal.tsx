import { useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin, Clock, Loader2, AlertTriangle, Navigation } from "lucide-react";
import { useClockIn } from "@/integrations/supabase/hooks/useTimeClock";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useProjectGeofence } from "@/integrations/supabase/hooks/useProjectGeofence";
import { LocationPermissionDialog } from "./LocationPermissionDialog";
import { toast } from "sonner";
import { isWithinGeofence, formatDistance, isValidCoordinates } from "@/utils/geoDistance";

interface Project {
  id: string;
  name: string;
  time_clock_enabled: boolean;
  require_clock_location: boolean;
}

interface ClockInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  personnelId: string;
}

export function ClockInModal({
  open,
  onOpenChange,
  projects,
  personnelId,
}: ClockInModalProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isClocking, setIsClocking] = useState(false);
  const [showLocationHelp, setShowLocationHelp] = useState(false);
  const [geofenceError, setGeofenceError] = useState<string | null>(null);
  const [distanceFromSite, setDistanceFromSite] = useState<number | null>(null);

  const clockIn = useClockIn();
  const { requestLocation, permissionState, geoData } = useGeolocation(false);
  const { data: projectGeofence, isLoading: loadingGeofence } = useProjectGeofence(selectedProjectId);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const requiresLocation = selectedProject?.require_clock_location ?? false;
  const isLocationDenied = permissionState === "denied";

  // Check if project has valid geofence coordinates
  const hasGeofenceCoordinates = useMemo(() => {
    if (!projectGeofence) return false;
    return isValidCoordinates(projectGeofence.site_lat, projectGeofence.site_lng);
  }, [projectGeofence]);

  const handleClockIn = useCallback(async () => {
    if (!selectedProjectId) {
      toast.error("Please select a project");
      return;
    }

    setGeofenceError(null);
    setDistanceFromSite(null);

    // Check if location is required but denied
    if (requiresLocation && isLocationDenied) {
      setShowLocationHelp(true);
      return;
    }

    setIsClocking(true);

    try {
      let geoData = {
        lat: null as number | null,
        lng: null as number | null,
        accuracy: null as number | null,
        source: null as "device" | "ip_fallback" | null,
        capturedAt: null as string | null,
        error: null as string | null,
      };

      if (requiresLocation) {
        const locationResult = await requestLocation();
        if (locationResult.error || !locationResult.lat) {
          if (locationResult.error?.includes("denied")) {
            setShowLocationHelp(true);
            setIsClocking(false);
            return;
          }
          toast.error("Could not get location: " + locationResult.error);
          setIsClocking(false);
          return;
        }
        geoData = locationResult;

        // Check geofence if project has coordinates
        if (hasGeofenceCoordinates && projectGeofence) {
          const radiusMiles = projectGeofence.geofence_radius_miles || 0.25;
          const withinGeofence = isWithinGeofence(
            geoData.lat!,
            geoData.lng!,
            projectGeofence.site_lat!,
            projectGeofence.site_lng!,
            radiusMiles
          );

          if (!withinGeofence) {
            // Calculate and show distance
            const { calculateDistanceMiles } = await import("@/utils/geoDistance");
            const distance = calculateDistanceMiles(
              geoData.lat!,
              geoData.lng!,
              projectGeofence.site_lat!,
              projectGeofence.site_lng!
            );
            setDistanceFromSite(distance);
            setGeofenceError(
              `You must be within ${formatDistance(radiusMiles)} of the job site to clock in. You are currently ${formatDistance(distance)} away.`
            );
            setIsClocking(false);
            return;
          }
        }
      }

      await clockIn.mutateAsync({
        projectId: selectedProjectId,
        personnelId,
        geoData,
      });

      onOpenChange(false);
      setSelectedProjectId("");
      setGeofenceError(null);
      setDistanceFromSite(null);
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsClocking(false);
    }
  }, [selectedProjectId, personnelId, requiresLocation, isLocationDenied, requestLocation, clockIn, onOpenChange, hasGeofenceCoordinates, projectGeofence]);

  // Reset state when modal closes
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSelectedProjectId("");
      setGeofenceError(null);
      setDistanceFromSite(null);
    }
    onOpenChange(open);
  }, [onOpenChange]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Clock In
            </DialogTitle>
            <DialogDescription>
              Select the project you're working on today
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {projects.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No clock-enabled projects available
              </p>
            ) : (
              <RadioGroup
                value={selectedProjectId}
                onValueChange={(value) => {
                  setSelectedProjectId(value);
                  setGeofenceError(null);
                  setDistanceFromSite(null);
                }}
                className="space-y-3"
              >
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className={`flex items-center space-x-3 rounded-lg border p-4 transition-colors ${
                      selectedProjectId === project.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <RadioGroupItem value={project.id} id={project.id} />
                    <Label
                      htmlFor={project.id}
                      className="flex-1 cursor-pointer flex items-center justify-between"
                    >
                      <span className="font-medium">{project.name}</span>
                      {project.require_clock_location && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          Location Required
                        </span>
                      )}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {/* Geofence warning when project requires location but has no coordinates */}
            {selectedProjectId && requiresLocation && !loadingGeofence && !hasGeofenceCoordinates && (
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <Navigation className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700">
                  This project requires location but has no job site coordinates configured. 
                  Location will be captured but geofence verification is disabled.
                </AlertDescription>
              </Alert>
            )}

            {/* Geofence error when user is outside the radius */}
            {geofenceError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{geofenceError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isClocking}
            >
              Cancel
            </Button>
            <Button
              onClick={handleClockIn}
              disabled={!selectedProjectId || isClocking || projects.length === 0 || loadingGeofence}
            >
              {isClocking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {requiresLocation ? "Verifying Location..." : "Clocking In..."}
                </>
              ) : (
                "Start Working"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LocationPermissionDialog
        open={showLocationHelp}
        onOpenChange={setShowLocationHelp}
      />
    </>
  );
}
