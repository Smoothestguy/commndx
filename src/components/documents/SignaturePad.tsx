import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { SignatureCanvas, SignatureCanvasHandle } from './SignatureCanvas';

export function SignaturePad({ name, onSave, onSkip, saving, required = false, compact = false, description = "One signature covers all of today's sites." }: {
  name: string; onSave: (blob: Blob) => void; onSkip: () => void; saving: boolean; description?: string; required?: boolean; compact?: boolean;
}) {
  const canvasRef = useRef<SignatureCanvasHandle>(null);
  const [hasInk, setHasInk] = useState(false);
  const clear = () => canvasRef.current?.clear();
  const save = () => {
    canvasRef.current?.toBlob((b) => b && onSave(b));
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 text-center shrink-0">
        <p className="text-lg font-semibold">{name}, sign here</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className={`mx-4 relative rounded-lg outline outline-2 outline-dashed outline-border bg-card ${compact ? 'shrink-0 h-[40dvh] min-h-[280px] landscape:h-[300px]' : 'flex-1 min-h-[280px] landscape:min-h-[300px]'}`}>
        <SignatureCanvas ref={canvasRef} resetKey={name} onInkChange={setHasInk} className="absolute inset-0 w-full h-full" />
      </div>
      <div className="p-4 flex gap-3 shrink-0">
        <Button type="button" variant="outline" size="lg" className="h-14 flex-1 text-base" onClick={clear}>Clear</Button>
        {!required && <Button type="button" variant="ghost" size="lg" className="h-14" onClick={onSkip}>Skip</Button>}
        <Button type="button" size="lg" className="h-14 flex-1 text-base" disabled={!hasInk || saving} onClick={save}>
          {saving && <Loader2 className="h-5 w-5 animate-spin mr-2" />}Save
        </Button>
      </div>
    </div>
  );
}

