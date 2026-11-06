import { Input } from './input';
import type { ComponentProps } from 'react';
/** Wall-clock text avoids browser/OS-dependent AM/PM controls. */
export function Time24Input(props: Omit<ComponentProps<typeof Input>, 'type'>) {
  return <Input {...props} type="text" inputMode="numeric" placeholder={props.placeholder || 'HH:mm'} maxLength={5} pattern="([01][0-9]|2[0-3]):[0-5][0-9]" />;
}