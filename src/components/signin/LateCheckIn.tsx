import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { localTime } from '@/lib/signinSheets';

export function LateCheckIn({ rejection, timezone, busy, onSubmit }: { rejection: { shift_start?: string; minutes_late?: number }; timezone?: string; busy: boolean; onSubmit: (reason: string) => void }) {
  const [choice, setChoice] = useState('');
  const [text, setText] = useState('');
  const reason = choice === 'Other' ? text.trim() : choice;
  const start = rejection.shift_start && /^\d{2}:\d{2}/.test(rejection.shift_start) ? rejection.shift_start.slice(0, 5) : rejection.shift_start ? localTime(rejection.shift_start, timezone || 'America/Chicago') : '—';
  return <section role="status" className="border-2 border-warning bg-warning/10 text-warning rounded-md p-5 space-y-4">
    <h1 className="text-2xl font-semibold">Your shift started at {start} — you're {rejection.minutes_late ?? 0} min late. Add a reason to clock in.</h1>
    <div className="flex flex-wrap gap-2">{['Traffic', 'Overslept', 'Personal', 'Supervisor knows', 'Other'].map(r => <Button key={r} variant={choice === r ? 'default' : 'outline'} disabled={busy} aria-pressed={choice === r} onClick={() => setChoice(r)}>{r}</Button>)}</div>
    {choice === 'Other' && <Textarea aria-label="Late arrival reason" placeholder="Reason (required)" maxLength={200} value={text} disabled={busy} onChange={e => setText(e.target.value)} />}
    <Button className="w-full min-h-14" disabled={busy || !reason} onClick={() => onSubmit(reason)}>Clock in</Button>
  </section>;
}