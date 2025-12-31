import { useState } from "react";
import { MapPin, RefreshCw, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  useProjectGeofence,
  useGeocodeProject,
  useUpdateProjectGeofence,
} from "@/integrations/supabase/hooks/useProjectGeofence";

interface GeofenceSettingsProps {
  projectId: string;
}

export function GeofenceSettings({ projectId }: GeofenceSettingsProps) {
  const { data: geofence, isLoading } = useProjectGeofence(projectId);
  const geocodeProject = useGeocodeProject();
  const updateGeofence = useUpdateProjectGeofence();

  const [localRadius, setLocalRadius] = useState<number | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading geofence settings...
        </CardContent>
      </Card>
    );
  }

  if (!geofence) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Project not found
        </CardContent>
      </Card>
    );
  }

  const hasCoordinates = geofence.site_lat && geofence.site_lng;
  const hasAddress = geofence.address;
  const radius = localRadius ?? geofence.geofence_radius_miles;

  const handleRadiusChange = (value: number[]) => {
    setLocalRadius(value[0]);
  };

  const handleRadiusCommit = () => {
    if (localRadius !== null && localRadius !== geofence.geofence_radius_miles) {
      updateGeofence.mutate({
        projectId,
        geofenceRadiusMiles: localRadius,
      });
    }
  };

  const handleToggleLocation = (checked: boolean) => {
    updateGeofence.mutate({
      projectId,
      requireClockLocation: checked,
    });
  };

  const handleGeocode = () => {
    geocodeProject.mutate(projectId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Geofence Settings
        </CardTitle>
        <CardDescription>
          Configure location-based clock-in requirements for this project
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Location Status */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Site Location</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {hasAddress ? (
                  <>
                    {geofence.address}
                    {geofence.city && `, ${geofence.city}`}
                    {geofence.state && `, ${geofence.state}`}
                    {geofence.zip && ` ${geofence.zip}`}
                  </>
                ) : (
                  "No address configured"
                )}
              </p>
            </div>
            {hasCoordinates ? (
              <Badge variant="default" className="bg-green-600">
                <Check className="h-3 w-3 mr-1" />
                Geocoded
              </Badge>
            ) : (
              <Badge variant="secondary">
                <AlertCircle className="h-3 w-3 mr-1" />
                Not Geocoded
              </Badge>
            )}
          </div>

          {hasCoordinates && (
            <p className="text-xs text-muted-foreground">
              Coordinates: {geofence.site_lat?.toFixed(6)}, {geofence.site_lng?.toFixed(6)}
            </p>
          )}

          {hasAddress && !hasCoordinates && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGeocode}
              disabled={geocodeProject.isPending}
            >
              {geocodeProject.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Geocoding...
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4 mr-2" />
                  Geocode Address
                </>
              )}
            </Button>
          )}

          {hasCoordinates && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGeocode}
              disabled={geocodeProject.isPending}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Re-geocode
            </Button>
          )}
        </div>

        {/* Require Location Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <Label className="text-base">Require Location for Clock-In</Label>
            <p className="text-sm text-muted-foreground">
              Personnel must be within the geofence to clock in
            </p>
          </div>
          <Switch
            checked={geofence.require_clock_location}
            onCheckedChange={handleToggleLocation}
            disabled={updateGeofence.isPending || !hasCoordinates}
          />
        </div>

        {/* Radius Slider */}
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <Label className="text-base">Geofence Radius</Label>
            <Badge variant="outline" className="font-mono">
              {radius.toFixed(2)} miles
            </Badge>
          </div>
          <Slider
            value={[radius]}
            onValueChange={handleRadiusChange}
            onValueCommit={handleRadiusCommit}
            min={0.1}
            max={1.0}
            step={0.05}
            disabled={!geofence.require_clock_location}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0.1 mi</span>
            <span>0.25 mi (recommended)</span>
            <span>1.0 mi</span>
          </div>
        </div>

        {!hasCoordinates && geofence.require_clock_location && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Geocoding Required
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Add an address to this project and geocode it to enable location verification.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
