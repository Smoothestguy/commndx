import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { IdCard, Printer, Ban, Loader2 } from 'lucide-react';
import { activeBadge, issueBadge, printBadges, revokeBadge } from '@/lib/personnelBadges';
import { toast } from 'sonner';
export function PersonnelBadgeActions({ personnelId, compact = false }: { personnelId: string; compact?: boolean }) {
  const { isAdmin, isManager } = useUserRole(); const allowed = isAdmin || isManager;
  const cache = useQueryClient(); const [busy, setBusy] = useState(false);
  const { data: badge } = useQuery({ queryKey: ['personnel-badge', personnelId], queryFn: () => activeBadge(personnelId), enabled: allowed });
  const run = async (action: 'issue' | 'print' | 'revoke') => { setBusy(true); try { if (action === 'issue') { await issueBadge(personnelId); toast.success('Badge issued; prior badge revoked'); } else if (action === 'revoke') { await revokeBadge(personnelId); toast.success('Badge revoked'); } else await printBadges([personnelId]); await cache.invalidateQueries({ queryKey: ['personnel-badge', personnelId] }); } catch (e) { toast.error(e instanceof Error ? e.message : 'Badge action failed'); } finally { setBusy(false); } };
  if (!allowed) return null;
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size={compact ? 'icon' : 'sm'} aria-label="Badge actions" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <IdCard className="h-4 w-4" />}{!compact && <span className="ml-2">Badge</span>}</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => void run('issue')}><IdCard className="mr-2 h-4 w-4" />{badge ? 'Replace badge' : 'Issue badge'}</DropdownMenuItem><DropdownMenuItem disabled={!badge} onClick={() => void run('print')}><Printer className="mr-2 h-4 w-4" />Badge PDF</DropdownMenuItem><DropdownMenuItem disabled={!badge} onClick={() => void run('revoke')}><Ban className="mr-2 h-4 w-4" />Revoke badge</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}