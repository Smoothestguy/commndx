import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/integrations/supabase/hooks/useProfile';
import { useMobileApprovals } from '@/hooks/useMobileApprovals';
import { usePhoneToday } from '@/hooks/usePhoneToday';
import { crewDayPath, type SiteCard } from '@/lib/phoneToday';
import { localDay } from '@/lib/signinSheets';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Activity, MapPin, Clock, Users, Tent, Settings, Send, UserPlus, Search, CheckCheck, ChevronRight, AlertTriangle, User } from 'lucide-react';
const PhoneQuickActions = lazy(() => import('./PhoneQuickActions').then(m => ({ default: m.PhoneQuickActions })));

const more = [{ label: 'Activity', Icon: Activity, to: '/?mobile=activity' }, { label: 'Locations', Icon: MapPin, to: '/locations' }, { label: 'Time', Icon: Clock, to: '/time-tracking' }, { label: 'Workforce', Icon: Users, to: '/personnel' }, { label: 'Event Manager', Icon: Tent, to: '/events' }, { label: 'Settings', Icon: Settings, to: '/settings' }];
const headerDay = (day: string) => { const d = new Date(`${day}T12:00:00Z`); return `${d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })} ${day.slice(5, 7)}/${day.slice(8, 10)}`; };

function Chip({ n, label, tone }: { n: number; label: string; tone: 'destructive' | 'warning' }) {
  if (n <= 0) return null;
  return <Badge variant="outline" className={`font-normal ${tone === 'destructive' ? 'text-destructive border-destructive/40' : 'text-warning border-warning/40'}`}>{n} {label}</Badge>;
}
function SiteRow({ c }: { c: SiteCard }) {
  return <Link to={crewDayPath({ id: c.id, project_id: c.projectId })} aria-label={`${c.name} crew today`} className="phone-card block p-3 space-y-1.5 active:opacity-80">
    <div className="flex items-center gap-2 min-w-0"><span className="flex-1 min-w-0 truncate font-semibold text-sm" title={c.name}>{c.name}</span><Badge variant="secondary" className="shrink-0 font-normal text-[10px]">{c.projectBadge}</Badge><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></div>
    <p className="text-xs text-muted-foreground"><strong className="text-foreground">{c.onSheet}</strong> on sheet{c.required != null && <> / {c.required} required</>}</p>
    <div className="flex flex-wrap gap-1">{c.problems ? <>
      <Chip n={c.needAction} label="need action" tone="destructive" /><Chip n={c.missingSignatures} label="missing signatures" tone="warning" /><Chip n={c.openPunches} label="open punches" tone="warning" /><Chip n={c.overlaps} label="also at another site" tone="destructive" />
    </> : <Badge variant="outline" className="font-normal text-success border-success/40">All good</Badge>}</div>
  </Link>;
}
function FindPerson({ onClose }: { onClose: () => void }) {
  const [term, setTerm] = useState(''), navigate = useNavigate();
  const t = term.trim();
  const r = useQuery({ queryKey: ['phone-find-person', t], enabled: t.length >= 2, queryFn: async () => {
    const words = t.split(/\s+/).slice(0, 3); let q = supabase.from('personnel').select('id,first_name,last_name,phone').limit(15);
    for (const w of words) { const s = w.replace(/[%,()]/g, ''); q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,phone.ilike.%${s}%`); }
    const res = await q; if (res.error) throw res.error; return res.data ?? [];
  } });
  return <Dialog open onOpenChange={v => { if (!v) onClose(); }}><DialogContent className="phone-surface max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Find person</DialogTitle></DialogHeader>
    <Input autoFocus aria-label="Search personnel" placeholder="Name or phone" value={term} onChange={e => setTerm(e.target.value)} />
    <div className="divide-y">{(r.data ?? []).map(p => <Button key={p.id} variant="ghost" className="w-full min-h-12 h-auto justify-between" onClick={() => { onClose(); navigate(`/personnel/${p.id}`); }}><span className="text-left">{[p.first_name, p.last_name].filter(Boolean).join(' ')}<span className="block text-xs text-muted-foreground">{p.phone}</span></span><ChevronRight className="h-4 w-4" /></Button>)}</div>
    {t.length >= 2 && r.isSuccess && !r.data.length && <p className="text-sm text-muted-foreground">No matches.</p>}
  </DialogContent></Dialog>;
}

/** Manager phone Home: Today dashboard (read-only). */
export function PhoneToday() {
  const { scope, q } = usePhoneToday(), inbox = useMobileApprovals();
  const { data: profile } = useProfile(), { signOut } = useAuth();
  const [params] = useSearchParams();
  const [dialog, setDialog] = useState<'text' | 'log' | 'find' | null>(null), [all, setAll] = useState(false), [account, setAccount] = useState(false);
  useEffect(() => { if (params.get('profile') === '1') setAccount(true); }, [params]);
  const loading = scope.isLoading || q.isLoading, data = q.data;
  const zone = scope.data?.locations[0]?.timezone || 'America/Chicago';
  const count = inbox.data?.count;
  const attention = data ? [...data.attention, ...data.onboarding] : [];
  const initials = [profile?.first_name, profile?.last_name].filter(Boolean).map(n => n![0]).join('') || '·';
  const actions = [
    { id: 'text', label: 'Text links', Icon: Send, run: () => setDialog('text') },
    { id: 'log', label: 'Add time', Icon: UserPlus, run: () => setDialog('log') },
    { id: 'find', label: 'Find person', Icon: Search, run: () => setDialog('find') },
  ] as const;
  return <div aria-label="Manager mobile Home" className="px-4 pt-3 pb-28 space-y-4">
    <header className="flex items-center gap-3">
      <h1 className="flex-1 min-w-0 text-sm font-semibold">{loading ? <Skeleton className="h-5 w-56" /> : <>{headerDay(localDay(new Date().toISOString(), zone))} · {data?.cards.length ?? 0} active site{data?.cards.length === 1 ? '' : 's'} · {data?.onSheet ?? 0} on sheet</>}</h1>
      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-secondary text-xs font-semibold" aria-label="Account" aria-expanded={account} onClick={() => setAccount(v => !v)}>{initials}</Button>
    </header>
    {account && <div className="phone-card p-2 flex gap-2"><Button asChild variant="ghost" className="flex-1 min-h-11"><Link to="/settings"><User className="h-4 w-4 mr-2" />Account</Link></Button><Button variant="ghost" className="flex-1 min-h-11" onClick={() => void signOut()}>Sign out</Button></div>}

    <section aria-label="Quick actions" className="grid grid-cols-4 gap-2">
      {actions.map(a => <Button key={a.id} variant="outline" className="phone-card h-20 flex-col gap-1.5 px-1 whitespace-normal text-[11px] leading-tight" onClick={a.run}><a.Icon className="h-5 w-5" />{a.label}</Button>)}
      <Button asChild variant="outline" className="phone-card h-20 flex-col gap-1.5 px-1 whitespace-normal text-[11px] leading-tight"><Link to="/approvals"><CheckCheck className="h-5 w-5" />Approvals{count ? ` (${count})` : ''}</Link></Button>
    </section>

    <section aria-label="Today's sites" className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today's sites</h2>
      {loading ? [0, 1, 2].map(k => <Skeleton key={k} className="h-[84px] w-full rounded-xl" />) : data?.cards.length ? data.cards.map(c => <SiteRow key={c.id} c={c} />) : <p className="text-sm text-muted-foreground">No active sites with crew today.</p>}
    </section>

    {(loading || attention.length > 0) && <section aria-label="Needs attention" className="space-y-2">
      <div className="flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Needs attention{attention.length ? ` · ${attention.length}` : ''}</h2>{attention.length > 5 && <Button variant="link" className="h-auto p-0 text-xs" onClick={() => setAll(v => !v)}>{all ? 'Show less' : 'See all'}</Button>}</div>
      {loading ? <Skeleton className="h-32 w-full rounded-xl" /> : <div className="phone-card divide-y">{(all ? attention : attention.slice(0, 5)).map(a => <Link key={a.key} to={a.to} className="flex items-center gap-3 px-3 py-2.5 min-h-12"><AlertTriangle className={`h-4 w-4 shrink-0 ${a.kind === 'overlap' || a.kind === 'stale_open' ? 'text-destructive' : 'text-warning'}`} /><span className="flex-1 min-w-0"><span className="block text-sm truncate">{a.text}</span><span className="block text-[11px] text-muted-foreground truncate">{a.detail}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></Link>)}</div>}
    </section>}

    <Link to="/approvals" className="phone-card flex items-center gap-3 px-3 min-h-12"><CheckCheck className="h-4 w-4 text-info" /><span className="flex-1 text-sm font-medium">Approvals</span><span className="text-xs text-muted-foreground">{count === undefined ? '…' : count ? `${count} pending` : 'Nothing pending'}</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></Link>

    <section aria-label="More" className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">More</h2>
      <div className="grid grid-cols-3 gap-2">{more.map(m => <Link key={m.label} to={m.to} className="phone-card flex flex-col items-center justify-center gap-1 h-16 text-[11px]"><m.Icon className="h-4 w-4 text-muted-foreground" />{m.label}</Link>)}</div>
    </section>

    {(q.error || scope.error) && <p role="alert" className="text-sm text-destructive">Today's data could not load. <Button variant="link" onClick={() => void q.refetch()}>Retry</Button></p>}
    {dialog === 'find' && <FindPerson onClose={() => setDialog(null)} />}
    {(dialog === 'text' || dialog === 'log') && <Suspense fallback={null}><PhoneQuickActions initial={dialog} onClose={() => setDialog(null)} /></Suspense>}
  </div>;
}
