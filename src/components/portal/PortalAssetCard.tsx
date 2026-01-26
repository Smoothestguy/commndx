import { useState } from "react";
import { 
  Car, 
  Key, 
  Badge as BadgeIcon, 
  Wrench, 
  MapPin, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  Laptop,
  Package,
  ExternalLink
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { PortalAssignedAsset } from "@/integrations/supabase/hooks/usePortalAssets";

const assetTypeConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  vehicle: { icon: Car, label: "Vehicle" },
  key: { icon: Key, label: "Key" },
  badge: { icon: BadgeIcon, label: "Badge" },
  tool: { icon: Wrench, label: "Tool" },
  device: { icon: Laptop, label: "Device" },
  equipment: { icon: Package, label: "Equipment" },
  location: { icon: MapPin, label: "Location" },
  other: { icon: Package, label: "Other" },
};

interface PortalAssetCardProps {
  assignment: PortalAssignedAsset;
  showProject?: boolean;
}

export function PortalAssetCard({ assignment, showProject = false }: PortalAssetCardProps) {
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const asset = assignment.asset;
  
  if (!asset) return null;
  
  const config = assetTypeConfig[asset.type] || assetTypeConfig.other;
  const Icon = config.icon;
  
  const hasInstructions = asset.instructions || asset.access_instructions || asset.gate_code;
  
  const googleMapsUrl = asset.address 
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(asset.address)}`
    : null;

  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{asset.label}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {config.label}
              </Badge>
              {showProject && assignment.project && (
                <Badge variant="secondary" className="text-xs">
                  {assignment.project.name}
                </Badge>
              )}
            </div>
            {asset.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {asset.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Address with maps link */}
      {asset.address && (
        <div className="mt-3 flex items-start gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm">{asset.address}</p>
            {googleMapsUrl && (
              <a 
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
              >
                Open in Maps
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Operating Hours */}
      {asset.operating_hours && (
        <div className="mt-2 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{asset.operating_hours}</p>
        </div>
      )}

      {/* Collapsible Instructions */}
      {hasInstructions && (
        <Collapsible open={instructionsOpen} onOpenChange={setInstructionsOpen} className="mt-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between h-8 px-2">
              <span className="text-xs font-medium">
                {instructionsOpen ? "Hide" : "View"} Instructions
              </span>
              {instructionsOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2 p-3 rounded-lg bg-muted/50">
            {asset.gate_code && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Gate Code</p>
                <p className="text-sm font-mono">{asset.gate_code}</p>
              </div>
            )}
            {asset.access_instructions && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Access Instructions</p>
                <p className="text-sm whitespace-pre-wrap">{asset.access_instructions}</p>
              </div>
            )}
            {asset.instructions && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Instructions</p>
                <p className="text-sm whitespace-pre-wrap">{asset.instructions}</p>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Assignment Notes */}
      {assignment.notes && (
        <div className="mt-3 p-2 rounded bg-muted/50">
          <p className="text-xs text-muted-foreground">{assignment.notes}</p>
        </div>
      )}
    </div>
  );
}
