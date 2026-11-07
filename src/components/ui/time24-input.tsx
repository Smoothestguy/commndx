import { Input } from './input';
import type { ComponentProps } from 'react';
/** Wall-clock text avoids browser/OS-dependent AM/PM controls. */
export function Time24Input(props: Omit<ComponentProps<typeof Input>, 'type'>) {
  return <Input {...props} type="time" />;
}