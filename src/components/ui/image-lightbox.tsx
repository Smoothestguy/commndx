import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogOverlay,
} from "@/components/ui/dialog";

interface ImageLightboxProps {
  imageUrl: string | null;
  onClose: () => void;
  alt?: string;
}

export function ImageLightbox({ imageUrl, onClose, alt = "Enlarged image" }: ImageLightboxProps) {
  return (
    <Dialog open={!!imageUrl} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 border-0 bg-transparent shadow-none overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-50 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        {imageUrl && (
          <img
            src={imageUrl}
            alt={alt}
            className="max-w-full max-h-[85vh] object-contain mx-auto rounded-lg"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
