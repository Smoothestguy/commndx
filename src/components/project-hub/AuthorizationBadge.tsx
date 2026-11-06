import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLocationAuthorization } from '@/hooks/useLocationAuthorization';
export function AuthorizationBadge({ value }: { value?: NonNullable<ReturnType<typeof useLocationAuthorization>['data']>[string] }) {
  if (!value) return null;
  return <span className="inline-flex flex-wrap gap-1 text-xs"><Badge variant="outline" className={cn(value.over ? 'text-destructive border-destructive/40' : value.under ? 'text-warning border-warning/40' : 'text-success border-success/40')}>Authorized: {value.positions} · {value.over ? `${value.over} over` : value.under ? `${value.under} under` : 'matched'}</Badge>{(value.assets > 0 || value.actualAssets > 0) && <Badge variant="outline" className={cn(value.assetOver ? 'text-destructive border-destructive/40' : value.assetUnder ? 'text-warning border-warning/40' : 'text-success border-success/40')}>Assets {value.actualAssets}/{value.assets} · {value.assetOver ? `${value.assetOver} over` : value.assetUnder ? `${value.assetUnder} under` : 'matched'}</Badge>}</span>;
}