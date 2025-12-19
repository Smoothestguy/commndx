import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { PenLine, Trash2, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface SignaturePadProps {
  value?: string;
  onChange: (signature: string | null) => void;
  label?: string;
  required?: boolean;
  helpText?: string;
}

export function SignaturePad({
  value,
  onChange,
  label,
  required,
  helpText,
}: SignaturePadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
    return ctx;
  }, []);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Fill with white background
    const ctx = getContext();
    if (ctx) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [getContext]);

  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure canvas is mounted
      setTimeout(initCanvas, 50);
    }
  }, [isOpen, initCanvas]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = getContext();
    if (!ctx) return;

    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    
    const ctx = getContext();
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getContext();
    if (ctx) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    setHasSignature(false);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    
    const dataUrl = canvas.toDataURL("image/png");
    onChange(dataUrl);
    setIsOpen(false);
  };

  const clearSignature = () => {
    onChange(null);
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      {value ? (
        <div className="border rounded-lg p-2 bg-white relative">
          <img
            src={value}
            alt="Signature"
            className="max-h-24 mx-auto"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute top-1 right-1 h-8 w-8 p-0"
            onClick={clearSignature}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ) : (
        <div
          onClick={() => setIsOpen(true)}
          className="border rounded-lg p-4 bg-muted/30 h-24 flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
        >
          <div className="text-center text-muted-foreground">
            <PenLine className="h-6 w-6 mx-auto mb-2" />
            <p className="text-sm">Click to sign</p>
          </div>
        </div>
      )}

      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Draw your signature</DialogTitle>
          </DialogHeader>
          
          <div className="border rounded-lg overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              className="w-full h-48 touch-none cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          
          <DialogFooter className="flex-row gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={clearCanvas}
              className="flex-1 sm:flex-none"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
            <Button
              type="button"
              onClick={saveSignature}
              disabled={!hasSignature}
              className="flex-1 sm:flex-none"
            >
              <Check className="h-4 w-4 mr-2" />
              Save Signature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
