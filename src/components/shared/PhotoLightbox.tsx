import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LightboxPhoto {
  url: string;
  caption?: string | null;
  date?: string | null;
}

interface Props {
  photos: LightboxPhoto[];
  index?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIndexChange?: (index: number) => void;
}

/**
 * Near-fullscreen photo viewer. Shows the original image at native resolution
 * (object-contain, no transforms) so small source photos are never upscaled.
 */
export function PhotoLightbox({ photos, index = 0, open, onOpenChange, onIndexChange }: Props) {
  const [i, setI] = useState(index);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => setI(index), [index, open]);
  useEffect(() => {
    if (!open) setZoomed(false);
  }, [open]);

  const go = (next: number) => {
    const clamped = (next + photos.length) % Math.max(1, photos.length);
    setI(clamped);
    setZoomed(false);
    onIndexChange?.(clamped);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const photo = photos[i];
  if (!photo) return null;

  const filename = photo.caption ?? photo.url.split("/").pop()?.split("?")[0] ?? "photo";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[96vw] w-[96vw] h-[92vh] border-none bg-background/95 p-0 sm:rounded-lg"
        onClick={(e) => {
          if (e.target === e.currentTarget) onOpenChange(false);
        }}
      >
        <div className="relative flex h-full w-full flex-col">
          <div
            className="flex flex-1 items-center justify-center overflow-auto p-4"
            style={{ touchAction: "pinch-zoom" }}
            onClick={(e) => {
              if (e.target === e.currentTarget) onOpenChange(false);
            }}
          >
            <img
              src={photo.url}
              alt={filename}
              className={cn(
                "select-none",
                zoomed
                  ? "max-w-none cursor-zoom-out"
                  : "max-h-full max-w-full object-contain cursor-zoom-in"
              )}
              onClick={() => setZoomed((z) => !z)}
            />
          </div>

          {photos.length > 1 && (
            <>
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-3 top-1/2 -translate-y-1/2"
                onClick={() => go(i - 1)}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-3 top-1/2 -translate-y-1/2"
                onClick={() => go(i + 1)}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}

          <div className="flex items-center justify-between gap-3 border-t px-4 py-2 text-sm">
            <div className="min-w-0 truncate text-muted-foreground">
              <span className="truncate">{filename}</span>
              {photo.date && <span className="ml-2">· {photo.date}</span>}
              {photos.length > 1 && (
                <span className="ml-2">
                  · {i + 1} / {photos.length}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setZoomed((z) => !z)}>
                {zoomed ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                <span className="ml-2">{zoomed ? "Fit" : "Actual size"}</span>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={photo.url} download={filename} target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4" />
                  <span className="ml-2">Download</span>
                </a>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Small helper for the common single-photo case. */
export function usePhotoLightbox() {
  const [photo, setPhoto] = useState<LightboxPhoto | null>(null);
  return {
    photo,
    open: !!photo,
    show: (url: string | null | undefined, caption?: string | null) =>
      url ? setPhoto({ url, caption }) : undefined,
    close: () => setPhoto(null),
  };
}
