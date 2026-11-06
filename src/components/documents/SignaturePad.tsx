import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function SignaturePad({ name, onSave, onSkip, saving, required = false, compact = false, description = "One signature covers all of today's sites." }: {
  name: string; onSave: (blob: Blob) => void; onSkip: () => void; saving: boolean; description?: string; required?: boolean; compact?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setHasInk(false);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(2, 2);
      ctx.strokeStyle = "#1a1aa6";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
  }, [name]);

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const start = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    const { x, y } = pos(e);
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const { x, y } = pos(e);
    ctx?.lineTo(x, y);
    ctx?.stroke();
    setHasInk(true);
  };
  const end = () => { drawing.current = false; };
  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasInk(false);
  };
  const save = () => {
    canvasRef.current?.toBlob((b) => b && onSave(b), "image/png");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 text-center">
        <p className="text-lg font-semibold">{name}, sign here</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className={compact ? "px-4 shrink-0" : "flex-1 px-4 min-h-0"}>
        <canvas
          ref={canvasRef}
          className={compact ? "block w-full h-[40dvh] max-h-96 rounded-lg border-2 border-dashed touch-none cursor-crosshair bg-card" : "w-full h-full min-h-[40vh] rounded-lg border-2 border-dashed touch-none cursor-crosshair bg-card"}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
      </div>
      <div className="p-4 flex gap-3">
        <Button variant="outline" size="lg" className="h-14 flex-1 text-base" onClick={clear}>Clear</Button>
        {!required && <Button variant="ghost" size="lg" className="h-14" onClick={onSkip}>Skip</Button>}
        <Button size="lg" className="h-14 flex-1 text-base" disabled={!hasInk || saving} onClick={save}>
          {saving && <Loader2 className="h-5 w-5 animate-spin mr-2" />}Save
        </Button>
      </div>
    </div>
  );
}

