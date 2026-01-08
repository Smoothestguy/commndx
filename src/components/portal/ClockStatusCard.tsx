import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Coffee,
  LogOut,
  Play,
  Loader2,
  MapPin,
  AlertTriangle,
} from "lucide-react";
import {
  ClockEntry,
  useClockOut,
  useStartLunch,
  useEndLunch,
  formatTime24h,
  formatDuration,
} from "@/integrations/supabase/hooks/useTimeClock";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useLocationMonitor } from "@/hooks/useLocationMonitor";
import { useProjectGeofence } from "@/integrations/supabase/hooks/useProjectGeofence";
import { LocationPermissionDialog } from "./LocationPermissionDialog";
import { ClockInModal } from "./ClockInModal";
import { TrackingStatusIndicator } from "@/components/location/TrackingStatusIndicator";

interface Project {
  id: string;
  name: string;
  time_clock_enabled: boolean;
  require_clock_location: boolean;
}

interface ClockStatusCardProps {
  personnelId: string;
  projects: Project[];
  activeEntry: ClockEntry | null;
}

export function ClockStatusCard({
  personnelId,
  projects,
  activeEntry,
}: ClockStatusCardProps) {
  const [showClockInModal, setShowClockInModal] = useState(false);
  const [showLocationHelp, setShowLocationHelp] = useState(false);
  const [isActioning, setIsActioning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [lunchElapsed, setLunchElapsed] = useState(0);

  const clockOut = useClockOut();
  const startLunch = useStartLunch();
  const endLunch = useEndLunch();
  const { requestLocation, permissionState } = useGeolocation(false);

  // Get project geofence data for location monitoring
  const { data: projectGeofence } = useProjectGeofence(activeEntry?.project_id);

  // Location monitoring hook - tracks location while clocked in
  const { isMonitoring, isNative, isNativeTracking, lastLocation } =
    useLocationMonitor(
      activeEntry
        ? {
            id: activeEntry.id,
            project_id: activeEntry.project_id,
            is_on_lunch: activeEntry.is_on_lunch ?? false,
            clock_blocked_until:
              (activeEntry as any).clock_blocked_until ?? null,
          }
        : null,
      projectGeofence
        ? {
            require_clock_location: projectGeofence.require_clock_location,
            site_lat: projectGeofence.site_lat,
            site_lng: projectGeofence.site_lng,
            geofence_radius_miles: projectGeofence.geofence_radius_miles,
          }
        : null
    );

  const isClockedIn = !!activeEntry;
  const isOnLunch = activeEntry?.is_on_lunch ?? false;
  const activeProject = activeEntry?.project;
  const requiresLocation = activeProject?.require_clock_location ?? false;
  const isLocationDenied = permissionState === "denied";
  const hasAlreadyTakenLunch =
    (activeEntry?.lunch_duration_minutes || 0) > 0 ||
    !!activeEntry?.lunch_end_at;

  // Check if clock-in is blocked (auto-clocked-out user)
  const clockBlockedUntil = (activeEntry as any)?.clock_blocked_until;
  const isBlocked =
    clockBlockedUntil && new Date(clockBlockedUntil) > new Date();

  // Update elapsed time every second
  useEffect(() => {
    if (!activeEntry?.clock_in_at) {
      setElapsedTime(0);
      return;
    }

    const updateElapsed = () => {
      const clockIn = new Date(activeEntry.clock_in_at);
      const now = new Date();
      const totalSeconds = Math.floor(
        (now.getTime() - clockIn.getTime()) / 1000
      );
      // Subtract lunch duration if applicable
      const lunchSeconds = (activeEntry.lunch_duration_minutes || 0) * 60;
      setElapsedTime(Math.max(0, totalSeconds - lunchSeconds));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [activeEntry?.clock_in_at, activeEntry?.lunch_duration_minutes]);

  // Update lunch elapsed time
  useEffect(() => {
    if (!activeEntry?.lunch_start_at || !activeEntry.is_on_lunch) {
      setLunchElapsed(0);
      return;
    }

    const updateLunchElapsed = () => {
      const lunchStart = new Date(activeEntry.lunch_start_at!);
      const now = new Date();
      const seconds = Math.floor((now.getTime() - lunchStart.getTime()) / 1000);
      setLunchElapsed(seconds);
    };

    updateLunchElapsed();
    const interval = setInterval(updateLunchElapsed, 1000);
    return () => clearInterval(interval);
  }, [activeEntry?.lunch_start_at, activeEntry?.is_on_lunch]);

  const handleStartLunch = useCallback(async () => {
    if (!activeEntry) return;

    setIsActioning(true);
    try {
      await startLunch.mutateAsync({
        entryId: activeEntry.id,
        personnelId,
        projectId: activeEntry.project_id,
      });
    } finally {
      setIsActioning(false);
    }
  }, [activeEntry, personnelId, startLunch]);

  const handleEndLunch = useCallback(async () => {
    if (!activeEntry || !activeEntry.lunch_start_at) return;

    setIsActioning(true);
    try {
      await endLunch.mutateAsync({
        entryId: activeEntry.id,
        personnelId,
        projectId: activeEntry.project_id,
        lunchStartAt: activeEntry.lunch_start_at,
      });
    } finally {
      setIsActioning(false);
    }
  }, [activeEntry, personnelId, endLunch]);

  const handleClockOut = useCallback(async () => {
    if (!activeEntry) return;

    // Check location if required
    if (requiresLocation && isLocationDenied) {
      setShowLocationHelp(true);
      return;
    }

    setIsActioning(true);
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
            setIsActioning(false);
            return;
          }
        }
        geoData = locationResult;
      }

      await clockOut.mutateAsync({
        entryId: activeEntry.id,
        personnelId,
        projectId: activeEntry.project_id,
        clockInAt: activeEntry.clock_in_at,
        lunchDurationMinutes: activeEntry.lunch_duration_minutes || 0,
        geoData,
      });
    } finally {
      setIsActioning(false);
    }
  }, [
    activeEntry,
    personnelId,
    requiresLocation,
    isLocationDenied,
    requestLocation,
    clockOut,
  ]);

  const formatElapsedTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Empty state - no clock-enabled projects assigned
  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Time Clock
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-2">
              No clock-enabled projects assigned
            </p>
            <p className="text-sm text-muted-foreground">
              Contact your supervisor to get assigned to a project.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card
        className={`${
          isClockedIn
            ? isOnLunch
              ? "border-amber-500/50 bg-amber-500/5"
              : "border-green-500/50 bg-green-500/5"
            : ""
        }`}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Time Clock
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isClockedIn ? (
            // Not clocked in state
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">
                You're not clocked in
              </p>
              <Button
                size="lg"
                onClick={() => setShowClockInModal(true)}
                className="min-w-[150px]"
              >
                <Play className="mr-2 h-4 w-4" />
                Clock In
              </Button>
            </div>
          ) : isOnLunch ? (
            // On lunch break state
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                <span className="font-medium text-amber-600">
                  On Lunch Break
                </span>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Project</span>
                  <span className="font-medium">{activeProject?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Lunch started</span>
                  <span className="font-medium">
                    {activeEntry.lunch_start_at
                      ? formatTime24h(activeEntry.lunch_start_at)
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">
                    Lunch duration
                  </span>
                  <span className="font-mono text-lg font-bold text-amber-600">
                    {formatElapsedTime(lunchElapsed)}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleEndLunch}
                disabled={isActioning}
                className="w-full"
                variant="default"
              >
                {isActioning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resuming...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Resume Working
                  </>
                )}
              </Button>
            </div>
          ) : (
            // Clocked in and working state
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <span className="font-medium text-green-600">
                  Currently Working
                </span>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Project</span>
                  <span className="font-medium">{activeProject?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Clocked in at</span>
                  <span className="font-medium">
                    {formatTime24h(activeEntry.clock_in_at)}
                  </span>
                </div>
                {(activeEntry.lunch_duration_minutes || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Lunch taken</span>
                    <span className="font-medium">
                      {formatDuration(activeEntry.lunch_duration_minutes || 0)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">
                    Time worked
                  </span>
                  <span className="font-mono text-2xl font-bold text-green-600">
                    {formatElapsedTime(elapsedTime)}
                  </span>
                </div>
              </div>

              {requiresLocation && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Location captured at clock in/out
                  </div>
                  <TrackingStatusIndicator
                    isTracking={isMonitoring}
                    isNative={isNative}
                    isNativeTracking={isNativeTracking}
                    lastLocation={lastLocation}
                  />
                </div>
              )}

              <div className="flex gap-2">
                {!hasAlreadyTakenLunch && (
                  <Button
                    onClick={handleStartLunch}
                    disabled={isActioning}
                    variant="outline"
                    className="flex-1"
                  >
                    {isActioning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Coffee className="mr-2 h-4 w-4" />
                        Lunch
                      </>
                    )}
                  </Button>
                )}
                <Button
                  onClick={handleClockOut}
                  disabled={isActioning}
                  variant="destructive"
                  className={hasAlreadyTakenLunch ? "w-full" : "flex-1"}
                >
                  {isActioning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <LogOut className="mr-2 h-4 w-4" />
                      Clock Out
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ClockInModal
        open={showClockInModal}
        onOpenChange={setShowClockInModal}
        projects={projects}
        personnelId={personnelId}
      />

      <LocationPermissionDialog
        open={showLocationHelp}
        onOpenChange={setShowLocationHelp}
      />
    </>
  );
}
