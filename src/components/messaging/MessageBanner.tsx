import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMessageBanner, type BannerItem } from "@/contexts/MessageBannerContext";

const AUTO_DISMISS_MS = 4000;

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - t);
  if (diff < 60_000) return "now";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

interface SingleBannerProps {
  item: BannerItem;
  onDismiss: () => void;
  onClick: () => void;
  index: number;
  collapsedCount?: number;
}

function SingleBanner({ item, onDismiss, onClick, index, collapsedCount }: SingleBannerProps) {
  const [exiting, setExiting] = useState(false);
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);
  const dismissed = useRef(false);

  const doDismiss = () => {
    if (dismissed.current) return;
    dismissed.current = true;
    setExiting(true);
    window.setTimeout(onDismiss, 220);
  };

  useEffect(() => {
    const t = window.setTimeout(doDismiss, AUTO_DISMISS_MS + index * 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startY.current == null) return;
    const dy = Math.min(0, e.clientY - startY.current); // only allow upward drag
    setDragY(dy);
  };
  const onPointerUp = () => {
    if (dragY < -40) doDismiss();
    else setDragY(0);
    startY.current = null;
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => {
        // Ignore click if it was a swipe
        if (dragY < -10) return;
        onClick();
      }}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); if (e.key === "Escape") doDismiss(); }}
      className={cn(
        "pointer-events-auto w-[min(92vw,420px)] cursor-pointer select-none",
        "rounded-2xl border border-border/60 bg-background/90 backdrop-blur-xl",
        "shadow-[0_10px_40px_-8px_rgba(0,0,0,0.35)]",
        "px-3 py-2.5 flex items-start gap-3",
        "transition-all duration-200 ease-out",
        exiting ? "opacity-0 -translate-y-4" : "opacity-100 translate-y-0",
        "animate-fade-in"
      )}
      style={{
        transform: `translateY(${exiting ? -16 : dragY}px)`,
        transition: startY.current == null ? "transform 200ms ease-out, opacity 200ms ease-out" : "none",
      }}
      aria-label={`New message from ${item.senderName}`}
    >
      <Avatar className="h-10 w-10 shrink-0">
        {item.senderPhotoUrl && <AvatarImage src={item.senderPhotoUrl} alt={item.senderName} />}
        <AvatarFallback className="text-xs font-medium">{initials(item.senderName)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold truncate">{item.senderName}</span>
          <span className="text-[11px] text-muted-foreground ml-auto shrink-0">{relativeTime(item.timestamp)}</span>
        </div>
        <p className="text-sm text-foreground/85 line-clamp-2 leading-snug">
          {collapsedCount && collapsedCount > 1 ? `${collapsedCount} new messages` : item.preview}
        </p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); doDismiss(); }}
        className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function MessageBanner() {
  const { banners, dismiss, muted, toggleMuted } = useMessageBanner();
  const navigate = useNavigate();

  if (banners.length === 0) return null;

  // Collapse: if 3+ from the same conversation, show one banner with a count.
  const bySender = new Map<string, BannerItem[]>();
  for (const b of banners) {
    const arr = bySender.get(b.conversationId) ?? [];
    arr.push(b);
    bySender.set(b.conversationId, arr);
  }

  const groups = Array.from(bySender.values());
  const shouldCollapse = groups.length === 1 && groups[0].length >= 3;

  const visible: { item: BannerItem; count?: number }[] = shouldCollapse
    ? [{ item: groups[0][groups[0].length - 1], count: groups[0].length }]
    : banners.slice(-3).map((b) => ({ item: b }));

  return (
    <div
      className="fixed left-0 right-0 top-2 z-[100] pointer-events-none flex flex-col items-center gap-2 px-2"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {visible.map((v, i) => (
        <SingleBanner
          key={v.item.id}
          item={v.item}
          index={i}
          collapsedCount={v.count}
          onDismiss={() => {
            if (shouldCollapse) {
              // dismiss all in the group
              for (const b of groups[0]) dismiss(b.id);
            } else {
              dismiss(v.item.id);
            }
          }}
          onClick={() => {
            navigate(`/messages?conversation=${v.item.conversationId}`);
            if (shouldCollapse) {
              for (const b of groups[0]) dismiss(b.id);
            } else {
              dismiss(v.item.id);
            }
          }}
        />
      ))}
      {/* Mute toggle sits just under the topmost banner */}
      <button
        onClick={toggleMuted}
        className="pointer-events-auto mt-0.5 rounded-full bg-background/80 backdrop-blur border border-border/60 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 flex items-center gap-1 shadow-sm"
        aria-label={muted ? "Unmute banner sounds" : "Mute banner sounds"}
      >
        {muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
        {muted ? "Muted" : "Sound"}
      </button>
    </div>
  );
}
