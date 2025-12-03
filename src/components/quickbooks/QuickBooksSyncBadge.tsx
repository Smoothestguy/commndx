import { Badge } from "@/components/ui/badge";
import { Cloud, CloudOff, AlertTriangle, Loader2, Check } from "lucide-react";

interface QuickBooksSyncBadgeProps {
  status: 'synced' | 'pending' | 'conflict' | 'error' | 'not_synced';
  size?: 'sm' | 'default';
}

export const QuickBooksSyncBadge = ({ status, size = 'default' }: QuickBooksSyncBadgeProps) => {
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  
  switch (status) {
    case 'synced':
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
          <Check className={iconSize} />
          {size !== 'sm' && 'Synced'}
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 gap-1">
          <Loader2 className={`${iconSize} animate-spin`} />
          {size !== 'sm' && 'Pending'}
        </Badge>
      );
    case 'conflict':
      return (
        <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20 gap-1">
          <AlertTriangle className={iconSize} />
          {size !== 'sm' && 'Conflict'}
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 gap-1">
          <CloudOff className={iconSize} />
          {size !== 'sm' && 'Error'}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="bg-muted text-muted-foreground gap-1">
          <Cloud className={iconSize} />
          {size !== 'sm' && 'Not Synced'}
        </Badge>
      );
  }
};
