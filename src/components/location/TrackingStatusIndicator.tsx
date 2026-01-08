import { MapPin, MapPinOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TrackingStatusIndicatorProps {
  isTracking: boolean;
  isNative: boolean;
  isNativeTracking?: boolean;
  lastLocation?: { lat: number; lng: number } | null;
  className?: string;
}

export function TrackingStatusIndicator({
  isTracking,
  isNative,
  isNativeTracking,
  lastLocation,
  className,
}: TrackingStatusIndicatorProps) {
  if (!isTracking) {
    return null;
  }

  const getStatusInfo = () => {
    if (isNative) {
      if (isNativeTracking) {
        return {
          icon: MapPin,
          color: "text-green-500",
          bgColor: "bg-green-500/10",
          pulse: true,
          label: "Background tracking active",
          description: "Your location is being tracked even when the app is in the background",
        };
      } else {
        return {
          icon: Loader2,
          color: "text-yellow-500",
          bgColor: "bg-yellow-500/10",
          pulse: false,
          spin: true,
          label: "Starting tracking...",
          description: "Initializing background location tracking",
        };
      }
    } else {
      return {
        icon: MapPin,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
        pulse: true,
        label: "Location tracking active",
        description: "Your location is being tracked while this tab is open",
      };
    }
  };

  const status = getStatusInfo();
  const Icon = status.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
            status.bgColor,
            status.color,
            className
          )}
        >
          <div className="relative">
            <Icon
              className={cn(
                "h-3.5 w-3.5",
                status.spin && "animate-spin"
              )}
            />
            {status.pulse && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
              </span>
            )}
          </div>
          <span className="hidden sm:inline">{isNative ? "GPS" : "Location"}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium">{status.label}</p>
          <p className="text-xs text-muted-foreground">{status.description}</p>
          {lastLocation && (
            <p className="text-xs text-muted-foreground">
              Last: {lastLocation.lat.toFixed(4)}, {lastLocation.lng.toFixed(4)}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

