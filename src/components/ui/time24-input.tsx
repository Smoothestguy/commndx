import { Input } from './input';
import { useEffect, useState, type ChangeEvent, type ComponentProps } from 'react';
import { clockOutValue, normalizeMilitary, validMilitaryOut } from '@/lib/militaryTime';

type Props = Omit<ComponentProps<typeof Input>, 'type'> & { allowEndOfDay?: boolean };
const digits = (v: unknown) => String(v ?? '').replace(':', '');

/** Wall-clock text avoids browser/OS-dependent AM/PM controls. `allowEndOfDay` (time out only) accepts 2400 = end of day. */
export function Time24Input({ allowEndOfDay, ...props }: Props) {
  if (!allowEndOfDay) return <Input {...props} type="time" />;
  return <EndOfDayInput {...props} />;
}

function EndOfDayInput({ value, onChange, step: _step, ...props }: Omit<Props, 'allowEndOfDay'>) {
  const [draft, setDraft] = useState(digits(value));
  useEffect(() => { if (digits(value) !== normalizeMilitary(draft)) setDraft(digits(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const change = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9:]/g, '').slice(0, 5);
    setDraft(raw);
    const out = raw && validMilitaryOut(raw) ? clockOutValue(raw) : raw;
    onChange?.({ ...e, target: { ...e.target, value: out }, currentTarget: { ...e.currentTarget, value: out } } as unknown as ChangeEvent<HTMLInputElement>);
  };
  return <Input {...props} type="text" inputMode="numeric" placeholder={props.placeholder ?? 'HHMM'} maxLength={5} value={draft} onChange={change} />;
}
