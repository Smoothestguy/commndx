import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { useOpenClockEntry, useClockIn, useClockOut, formatDateTime24h } from "@/integrations/supabase/hooks/useTimeClock";
import { useGeolocation } from "@/hooks/useGeolocation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProjectClockCardProps {
  project: {
    id: string;
    name: string;
    time_clock_enabled: boolean;
    require_clock_location: boolean;
  };
  personnelId: string;
  hasOtherOpenEntry: boolean;
}

export function ProjectClockCard({ project, personnelId, hasOtherOpenEntry }: ProjectClockCardProps) {
  const { data: openEntry, isLoading: entryLoading } = useOpenClockEntry(personnelId, project.id);
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const { geoData, isRequesting: geoRequesting, requestLocation, hasLocation } = useGeolocation(false);
  const [isClocking, setIsClocking] = useState(false);

  const isClockedIn = !!openEntry;

  const handleClockIn = useCallback(async () => {
    setIsClocking(true);
    
    // Request location first
    requestLocation();
    
    // Wait for location result
    const waitForLocation = () => new Promise<typeof geoData>((resolve) => {
      const checkLocation = setInterval(() => {
        // We need to use a ref or state to get the latest geoData
        // For simplicity, we'll request and wait
      }, 100);
      
      // Use a timeout approach instead
      setTimeout(() => {
        clearInterval(checkLocation);
        resolve(geoData);
      }, 3000);
    });

    // Instead, we'll handle this in a useEffect-like manner
    // For now, let's use the geolocation API directly
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const locationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            source: "device" as const,
            capturedAt: new Date().toISOString(),
            error: null,
          };
          
          try {
            await clockIn.mutateAsync({
              projectId: project.id,
              personnelId,
              geoData: locationData,
            });
          } catch (error) {
            // Error handled by mutation
          } finally {
            setIsClocking(false);
          }
        },
        (error) => {
          if (project.require_clock_location) {
            toast.error("Location is required to clock in for this project");
            setIsClocking(false);
          } else {
            // Allow clock in without location
            clockIn.mutateAsync({
              projectId: project.id,
              personnelId,
              geoData: {
                lat: null,
                lng: null,
                accuracy: null,
                source: null,
                capturedAt: null,
                error: error.message,
              },
            }).finally(() => setIsClocking(false));
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    } else {
      if (project.require_clock_location) {
        toast.error("Geolocation is not supported by this browser");
        setIsClocking(false);
      } else {
        // Allow clock in without location
        await clockIn.mutateAsync({
          projectId: project.id,
          personnelId,
          geoData: {
            lat: null,
            lng: null,
            accuracy: null,
            source: null,
            capturedAt: null,
            error: "Geolocation not supported",
          },
        });
        setIsClocking(false);
      }
    }
  }, [project, personnelId, clockIn, requestLocation, geoData]);

  const handleClockOut = useCallback(async () => {
    if (!openEntry) return;
    
    setIsClocking(true);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const locationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            source: "device" as const,
            capturedAt: new Date().toISOString(),
            error: null,
          };
          
          try {
            await clockOut.mutateAsync({
              entryId: openEntry.id,
              personnelId,
              projectId: project.id,
              clockInAt: openEntry.clock_in_at,
              geoData: locationData,
            });
          } catch (error) {
            // Error handled by mutation
          } finally {
            setIsClocking(false);
          }
        },
        (error) => {
          if (project.require_clock_location) {
            toast.error("Location is required to clock out for this project");
            setIsClocking(false);
          } else {
            clockOut.mutateAsync({
              entryId: openEntry.id,
              personnelId,
              projectId: project.id,
              clockInAt: openEntry.clock_in_at,
              geoData: {
                lat: null,
                lng: null,
                accuracy: null,
                source: null,
                capturedAt: null,
                error: error.message,
              },
            }).finally(() => setIsClocking(false));
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    } else {
      if (project.require_clock_location) {
        toast.error("Geolocation is not supported by this browser");
        setIsClocking(false);
      } else {
        await clockOut.mutateAsync({
          entryId: openEntry.id,
          personnelId,
          projectId: project.id,
          clockInAt: openEntry.clock_in_at,
          geoData: {
            lat: null,
            lng: null,
            accuracy: null,
            source: null,
            capturedAt: null,
            error: "Geolocation not supported",
          },
        });
        setIsClocking(false);
      }
    }
  }, [openEntry, project, personnelId, clockOut]);

  const canClockIn = !isClockedIn && !hasOtherOpenEntry && !entryLoading;
  const canClockOut = isClockedIn && !entryLoading;

  return (
    <Card className={cn(
      "transition-all duration-200",
      isClockedIn && "border-green-500/50 bg-green-500/5"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{project.name}</span>
          {isClockedIn && (
            <span className="text-sm font-normal text-green-600 flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Active
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Clock Status */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {entryLoading ? (
            <span className="text-muted-foreground">Loading...</span>
          ) : isClockedIn && openEntry ? (
            <span className="text-foreground">
              Clocked in {formatDateTime24h(openEntry.clock_in_at)}
            </span>
          ) : (
            <span className="text-muted-foreground">Not clocked in</span>
          )}
        </div>

        {/* Location indicator for active clock */}
        {isClockedIn && openEntry && (
          <div className="flex items-center gap-2 text-sm">
            {openEntry.clock_in_lat && openEntry.clock_in_lng ? (
              <>
                <MapPin className="h-4 w-4 text-green-600" />
                <span className="text-green-600">Location captured</span>
                {openEntry.clock_in_accuracy && (
                  <span className="text-muted-foreground text-xs">
                    (±{Math.round(openEntry.clock_in_accuracy)}m)
                  </span>
                )}
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-amber-500">No location captured</span>
              </>
            )}
          </div>
        )}

        {/* Warning if has other open entry */}
        {hasOtherOpenEntry && !isClockedIn && (
          <div className="flex items-center gap-2 text-sm text-amber-500">
            <AlertTriangle className="h-4 w-4" />
            <span>You have an active clock on another project</span>
          </div>
        )}

        {/* Clock Actions */}
        <div className="flex gap-2">
          {!isClockedIn ? (
            <Button
              onClick={handleClockIn}
              disabled={!canClockIn || isClocking}
              className="flex-1"
            >
              {isClocking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Clocking In...
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  Clock In
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleClockOut}
              disabled={!canClockOut || isClocking}
              variant="destructive"
              className="flex-1"
            >
              {isClocking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Clocking Out...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Clock Out
                </>
              )}
            </Button>
          )}
        </div>

        {/* Location requirement notice */}
        {project.require_clock_location && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            Location required for clock in/out
          </p>
        )}
      </CardContent>
    </Card>
  );
}
