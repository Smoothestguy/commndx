import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Car, 
  Key, 
  MapPin, 
  Wrench, 
  Package, 
  Smartphone,
  Building,
  HelpCircle,
  Clock,
  FileText,
} from "lucide-react";
import type { PersonnelAsset } from "@/integrations/supabase/hooks/usePersonnelWithAssets";

interface PersonnelAssetsCellProps {
  assets: PersonnelAsset[];
}

const getAssetIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case "vehicle":
      return Car;
    case "key":
      return Key;
    case "location":
    case "hotel room":
      return Building;
    case "equipment":
      return Wrench;
    case "badge":
      return Package;
    case "device":
      return Smartphone;
    case "tool":
      return Wrench;
    default:
      return HelpCircle;
  }
};

const formatAssetType = (type: string) => {
  // Capitalize first letter of each word
  return type
    .split(/[\s_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

function AssetPill({ asset }: { asset: PersonnelAsset }) {
  const Icon = getAssetIcon(asset.type);
  
  return (
    <Badge variant="outline" className="flex items-center gap-1 text-xs font-normal">
      <Icon className="h-3 w-3" />
      <span className="truncate max-w-[150px]">
        {formatAssetType(asset.type)}: {asset.label}
      </span>
    </Badge>
  );
}

function AssetDetailItem({ asset }: { asset: PersonnelAsset }) {
  const Icon = getAssetIcon(asset.type);
  
  return (
    <div className="py-2 border-b last:border-b-0">
      <div className="flex items-center gap-2 font-medium text-sm">
        <Icon className="h-4 w-4 text-primary" />
        <span>{formatAssetType(asset.type)}: {asset.label}</span>
      </div>
      <div className="mt-1.5 space-y-1 text-xs text-muted-foreground pl-6">
        {asset.address && (
          <div className="flex items-start gap-1.5">
            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>{asset.address}</span>
          </div>
        )}
        {asset.accessHours && (
          <div className="flex items-start gap-1.5">
            <Clock className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>{asset.accessHours}</span>
          </div>
        )}
        {asset.instructions && (
          <div className="flex items-start gap-1.5">
            <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{asset.instructions}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function PersonnelAssetsCell({ assets }: PersonnelAssetsCellProps) {
  if (!assets || assets.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  // If 1-2 assets, show pills
  if (assets.length <= 2) {
    return (
      <div className="flex flex-wrap gap-1">
        {assets.map((asset) => (
          <Popover key={asset.assignmentId}>
            <PopoverTrigger asChild>
              <button className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded">
                <AssetPill asset={asset} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="start">
              <AssetDetailItem asset={asset} />
            </PopoverContent>
          </Popover>
        ))}
      </div>
    );
  }

  // If more than 2 assets, show "X assets" with popover
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-auto py-1 px-2 text-xs font-normal hover:bg-accent"
        >
          {assets.length} assets
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-[300px] overflow-y-auto p-3" align="start">
        <div className="space-y-0">
          {assets.map((asset) => (
            <AssetDetailItem key={asset.assignmentId} asset={asset} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
