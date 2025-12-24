import { useState, useCallback } from "react";
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
import { MapPin, Clock, Loader2 } from "lucide-react";
import { useClockIn } from "@/integrations/supabase/hooks/useTimeClock";
import { useGeolocation } from "@/hooks/useGeolocation";
import { LocationPermissionDialog } from "./LocationPermissionDialog";
import { toast } from "sonner";

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

  const clockIn = useClockIn();
  const { requestLocation, permissionState } = useGeolocation(false);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const requiresLocation = selectedProject?.require_clock_location ?? false;
  const isLocationDenied = permissionState === "denied";

  const handleClockIn = useCallback(async () => {
    if (!selectedProjectId) {
      toast.error("Please select a project");
      return;
    }

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
      }

      await clockIn.mutateAsync({
        projectId: selectedProjectId,
        personnelId,
        geoData,
      });

      onOpenChange(false);
      setSelectedProjectId("");
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsClocking(false);
    }
  }, [selectedProjectId, personnelId, requiresLocation, isLocationDenied, requestLocation, clockIn, onOpenChange]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
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

          <div className="py-4">
            {projects.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No clock-enabled projects available
              </p>
            ) : (
              <RadioGroup
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
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
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isClocking}
            >
              Cancel
            </Button>
            <Button
              onClick={handleClockIn}
              disabled={!selectedProjectId || isClocking || projects.length === 0}
            >
              {isClocking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Clocking In...
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
