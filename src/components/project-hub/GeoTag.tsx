import { MapPin } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { geoMapHref } from "@/lib/geoTag";

export function GeoTag({ lat, lng, label = "Geo-tagged check-in" }: { lat?: number | null; lng?: number | null; label?: string }) {
  const href = geoMapHref(lat, lng);
  if (!href) return null;
  return <TooltipProvider><Tooltip><TooltipTrigger asChild>
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} onClick={(e) => e.stopPropagation()} className="inline-flex align-middle items-center justify-center h-7 w-7 text-primary hover:bg-muted rounded-sm">
      <MapPin className="h-3.5 w-3.5" />
    </a>
  </TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip></TooltipProvider>;
}