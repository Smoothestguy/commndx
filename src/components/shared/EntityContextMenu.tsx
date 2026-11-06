import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
export type EntityAction = { label: string; run: () => void; destructive?: boolean };
/** Right-click names keeps the native anchor menu; other row/card surfaces show actions. */
export function EntityContextMenu({ href, person = false, actions = [], children }: { href: string; person?: boolean; actions?: EntityAction[]; children: ReactNode }) {
  const navigate = useNavigate();
  return <ContextMenu><ContextMenuTrigger asChild onContextMenuCapture={event => {
    if (event.target instanceof Element && event.target.closest('a[href]')) event.stopPropagation();
  }}>{children}</ContextMenuTrigger><ContextMenuContent className="w-56" onClick={e => e.stopPropagation()}>
    <ContextMenuItem onSelect={() => navigate(href)}>{person ? 'Open profile' : 'Open'}</ContextMenuItem>
    <ContextMenuItem onSelect={() => window.open(href, '_blank', 'noopener,noreferrer')}>Open in new tab</ContextMenuItem>
    {actions.length > 0 && <ContextMenuSeparator />}
    {actions.map(a => <ContextMenuItem key={a.label} className={a.destructive ? 'text-destructive' : ''} onSelect={a.run}>{a.label}</ContextMenuItem>)}
  </ContextMenuContent></ContextMenu>;
}