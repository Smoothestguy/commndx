import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";

export interface IndeterminateCheckboxProps
  extends Omit<React.ComponentProps<typeof Checkbox>, "ref"> {
  indeterminate?: boolean;
}

export function IndeterminateCheckbox({
  indeterminate = false,
  ...props
}: IndeterminateCheckboxProps) {
  const ref = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    if (!ref.current) return;
    // Radix Checkbox root renders a button
    (ref.current as HTMLButtonElement & { indeterminate: boolean }).indeterminate =
      !!indeterminate;
  }, [indeterminate]);

  return <Checkbox ref={ref} {...props} />;
}
