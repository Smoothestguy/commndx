import { usePublicLang } from '@/lib/publicLang';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { EARLY_REASONS, type EarlyRejection } from '@/lib/shiftDiscipline';
const EARLY_ES: Record<string, string> = { Other: 'Otro' };
export function EarlyCheckIn({ rejection, timezone, busy, onSubmit }: { rejection: EarlyRejection; timezone?: string; busy: boolean; onSubmit: (reason: string) => void }) {
  const { tr } = usePublicLang();
  const [open, setOpen] = useState(false), [choice, setChoice] = useState(''), [text, setText] = useState('');
  const reason = choice === 'Other' ? text.trim() : choice;
  const time = rejection.shift_start ? new Intl.DateTimeFormat('en-GB', { timeZone: timezone || 'America/Chicago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(rejection.shift_start)) : '—';
  return <section role="status" className="border-2 border-warning bg-warning/10 rounded-md p-5 space-y-4 text-warning">
    <h2 className="text-2xl font-bold">{tr(`Shift starts at ${time}. You're ${rejection.early_minutes} min early.`, `El turno empieza a las ${time}. Llegas ${rejection.early_minutes} min antes.`)}</h2>
    {!open ? <Button className="w-full h-20 text-xl" onClick={() => setOpen(true)}>{tr('CHECK IN EARLY', 'REGISTRAR ENTRADA TEMPRANA')}</Button> : <>
      <div className="flex flex-wrap gap-2">{EARLY_REASONS.map(r => <Button key={r} variant={choice === r ? 'default' : 'outline'} className="min-h-11" onClick={() => setChoice(r)}>{tr(r, EARLY_ES[r])}</Button>)}</div>
      {choice === 'Other' && <Textarea aria-label={tr("Early check-in reason", "Motivo de entrada temprana")} placeholder={tr("Reason (required)", "Motivo (obligatorio)")} maxLength={200} value={text} onChange={e => setText(e.target.value)} />}
      <Button className="w-full min-h-14" disabled={busy || !reason} onClick={() => onSubmit(reason)}>{tr('Record early check-in', 'Registrar entrada temprana')}</Button>
    </>}
  </section>;
}