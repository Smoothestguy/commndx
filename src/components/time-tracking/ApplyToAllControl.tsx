import { useState } from "react";
import { TimeDecimalInput } from "@/components/ui/time-decimal-input";
import { Button } from "@/components/ui/button";

interface ApplyToAllControlProps {
  onApply: (hours: number) => void;
}

export function ApplyToAllControl({ onApply }: ApplyToAllControlProps) {
  const [draftHours, setDraftHours] = useState<number>(0);
  
  return (
    <div className="flex items-center gap-2">
      <TimeDecimalInput
        value={draftHours}
        onValueChange={setDraftHours}
        placeholder="Hours"
        compact
        className="w-20 h-8 text-sm"
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-8 text-xs"
        onClick={() => {
          if (draftHours > 0) onApply(draftHours);
        }}
      >
        Apply to All
      </Button>
    </div>
  );
}
