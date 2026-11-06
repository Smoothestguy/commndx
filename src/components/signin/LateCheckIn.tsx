import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { localTime } from '@/lib/signinSheets';
import { usePublicLang } from '@/lib/publicLang';

const LATE_ES: Record<string, string> = { Traffic: 'Tráfico', Overslept: 'Me quedé dormido', Personal: 'Personal', 'Supervisor knows': 'El supervisor sabe', Other: 'Otro' };

export function LateCheckIn({ rejection, timezone, busy, onSubmit }: { rejection: { shift_start?: string; minutes_late?: number; grace_minutes?: number }; timezone?: string; busy: boolean; onSubmit: (reason: string) => void }) {
  const { tr } = usePublicLang();
  const [choice, setChoice] = useState('');
  const [text, setText] = useState('');
  const reason = choice === 'Other' ? text.trim() : choice;
  const start = rejection.shift_start && /^\d{2}:\d{2}/.test(rejection.shift_start) ? rejection.shift_start.slice(0, 5) : rejection.shift_start ? localTime(rejection.shift_start, timezone || 'America/Chicago') : '—';
  return <section role="status" className="border-2 border-warning bg-warning/10 text-warning rounded-md p-5 space-y-4">
    <h1 className="text-2xl font-semibold">{tr(`Your shift started at ${start} — you're ${rejection.minutes_late ?? 0} min late. Add a reason to clock in.`, `Tu turno empezó a las ${start} — llegas ${rejection.minutes_late ?? 0} min tarde. Agrega un motivo para registrar tu entrada.`)}</h1>
    {rejection.grace_minutes != null && <p className="text-sm">{tr(`This project's late grace period is ${rejection.grace_minutes} min.`, `El periodo de gracia de este proyecto es de ${rejection.grace_minutes} min.`)}</p>}
    <div className="flex flex-wrap gap-2">{['Traffic', 'Overslept', 'Personal', 'Supervisor knows', 'Other'].map(r => <Button key={r} variant={choice === r ? 'default' : 'outline'} disabled={busy} aria-pressed={choice === r} onClick={() => setChoice(r)}>{tr(r, LATE_ES[r])}</Button>)}</div>
    {choice === 'Other' && <Textarea aria-label={tr("Late arrival reason", "Motivo de llegada tarde")} placeholder={tr("Reason (required)", "Motivo (obligatorio)")} maxLength={200} value={text} disabled={busy} onChange={e => setText(e.target.value)} />}
    <Button className="w-full min-h-14" disabled={busy || !reason} onClick={() => onSubmit(reason)}>{tr('Clock in', 'Registrar entrada')}</Button>
  </section>;
}