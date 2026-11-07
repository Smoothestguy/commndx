import { useRef, useState } from "react";
import { SignatureCanvas, SignatureCanvasHandle } from "@/components/documents/SignatureCanvas";
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
  const canvasRef = useRef<SignatureCanvasHandle>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const clearCanvas = () => canvasRef.current?.clear();

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
        <div className="border rounded-lg p-2 bg-card relative">
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
        <DialogContent className="sm:max-w-md landscape:max-w-none landscape:w-[calc(100%-2rem)] max-h-[95dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Draw your signature</DialogTitle>
          </DialogHeader>
          
          <div className="border rounded-lg overflow-hidden bg-card">
            <SignatureCanvas ref={canvasRef} onInkChange={setHasSignature} className="w-full h-[280px] landscape:h-[300px]" />
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
