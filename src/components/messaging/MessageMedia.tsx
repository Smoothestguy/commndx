import { useEffect, useState } from "react";
import { Download, FileText, ImageOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export interface MessageMediaItem {
  path: string;
  content_type: string;
  size?: number;
}

function useSignedUrl(path: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.storage.from("sms-media").createSignedUrl(path, 3600).then(({ data, error }) => {
      if (!active) return;
      if (error || !data?.signedUrl) setFailed(true);
      else setUrl(data.signedUrl);
    });
    return () => { active = false; };
  }, [path]);
  return { url, failed };
}

function fileName(path: string) {
  return path.split("/").pop() || "attachment";
}

async function download(path: string) {
  const { data, error } = await supabase.storage.from("sms-media").download(path);
  if (error || !data) return;
  const href = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName(path);
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function ImageThumb({ item }: { item: MessageMediaItem }) {
  const { url, failed } = useSignedUrl(item.path);
  const [open, setOpen] = useState(false);
  if (failed) {
    return (
      <div className="flex h-24 w-40 items-center justify-center gap-2 rounded-xl border bg-muted text-xs text-muted-foreground">
        <ImageOff className="h-4 w-4" /> Photo unavailable
      </div>
    );
  }
  if (!url) {
    return (
      <div className="flex h-32 w-40 items-center justify-center rounded-xl bg-muted">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block overflow-hidden rounded-xl" aria-label="Open photo">
        <img src={url} alt="Photo sent by text" className="max-h-80 max-w-[240px] rounded-xl object-cover" loading="lazy" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] p-3 sm:max-w-4xl">
          <DialogTitle className="sr-only">Photo</DialogTitle>
          <img src={url} alt="Photo sent by text" className="max-h-[80vh] w-full rounded-lg object-contain" />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => download(item.path)}>
              <Download className="mr-2 h-4 w-4" /> Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FileChip({ item }: { item: MessageMediaItem }) {
  return (
    <button
      type="button"
      onClick={() => download(item.path)}
      className="flex items-center gap-2 rounded-xl border bg-muted px-3 py-2 text-xs text-foreground hover:bg-accent"
    >
      <FileText className="h-4 w-4" />
      <span className="max-w-[160px] truncate">{fileName(item.path)}</span>
      <Download className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}

export function MessageMedia({ media, alignEnd }: { media: MessageMediaItem[]; alignEnd?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 ${alignEnd ? "items-end" : "items-start"}`}>
      {media.map((m) =>
        m.content_type?.startsWith("image/") ? <ImageThumb key={m.path} item={m} /> : <FileChip key={m.path} item={m} />,
      )}
    </div>
  );
}
