import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AUTO_TEXT_TYPES } from '@/lib/autoTexts';
import { useAutoTextSettings, useAutoTextSentCounts } from '@/hooks/useAutoTextSettings';

/** Admin-only switches for automatic sign-in texts. Supervisor in-app alerts are not affected. */
export function AutoTextsCard() {
  const { settings, isLoading, error, save } = useAutoTextSettings();
  const counts = useAutoTextSentCounts();
  const busy = isLoading || save.isPending || !!error || !settings;
  return <Card><CardHeader><CardTitle className="text-base">Sign-in texts</CardTitle><CardDescription>Automatic texts only. Manual texts and supervisor in-app alerts are not affected. Each site can override these in its Edit location screen.</CardDescription></CardHeader>
    <CardContent className="divide-y">
      <div className="flex items-center justify-between gap-3 py-3"><Label htmlFor="auto-text-paused" className="font-semibold">Pause all automatic sign-in texts</Label><Switch id="auto-text-paused" checked={!!settings?.paused} disabled={busy} onCheckedChange={v => save.mutate(s => ({ ...s, paused: v }))} /></div>
      {AUTO_TEXT_TYPES.map(t => <div key={t.key} className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0"><Label htmlFor={`auto-text-${t.key}`}>{t.label}</Label><p className="text-xs text-muted-foreground">Sent last 7 days: {counts.data ? counts.data[t.key] : '…'}{settings?.paused ? ' · paused' : ''}</p></div>
        <Switch id={`auto-text-${t.key}`} checked={settings ? settings.types[t.key] : true} disabled={busy} onCheckedChange={v => save.mutate(s => ({ ...s, types: { ...s.types, [t.key]: v } }))} />
      </div>)}
      {error && <p role="alert" className="text-sm text-destructive py-2">Unable to load sign-in text settings.</p>}
    </CardContent></Card>;
}

/** Per-location Inherit / On / Off. Admin-only; saves immediately. */
export function LocationAutoTextOverrides({ locationId }: { locationId: string }) {
  const { settings, save, isAdmin, isLoading } = useAutoTextSettings();
  if (!isAdmin) return null;
  const row = settings?.locations[locationId] ?? {};
  return <section aria-label="Automatic sign-in texts" className="col-span-2 space-y-2 border-t pt-3">
    <h3 className="font-semibold text-sm">Automatic sign-in texts</h3>
    {settings?.paused && <p className="text-xs text-warning">All automatic sign-in texts are paused in Settings.</p>}
    {AUTO_TEXT_TYPES.map(t => <div key={t.key} className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm">{t.label}</span>
      <div className="inline-flex rounded-md border overflow-hidden" role="radiogroup" aria-label={t.label}>
        {(['inherit', 'on', 'off'] as const).map(v => { const active = (row[t.key] ?? 'inherit') === v; return <button key={v} type="button" role="radio" aria-checked={active} disabled={isLoading || save.isPending}
          className={`px-3 h-9 text-xs ${active ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
          onClick={() => save.mutate(s => { const cur = { ...(s.locations[locationId] ?? {}) }; if (v === 'inherit') delete cur[t.key]; else cur[t.key] = v; const locations = { ...s.locations }; if (Object.keys(cur).length) locations[locationId] = cur; else delete locations[locationId]; return { ...s, locations }; })}>
          {v === 'inherit' ? `Inherit (${settings?.types[t.key] === false ? 'off' : 'on'})` : v === 'on' ? 'On' : 'Off'}</button>; })}
      </div>
    </div>)}
  </section>;
}
