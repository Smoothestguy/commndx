import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export interface BannerItem {
  id: string; // message id
  conversationId: string;
  senderName: string;
  senderPhotoUrl?: string | null;
  preview: string;
  timestamp: string; // ISO
}

interface Ctx {
  banners: BannerItem[];
  push: (b: BannerItem) => void;
  dismiss: (id: string) => void;
  muted: boolean;
  toggleMuted: () => void;
}

const MessageBannerContext = createContext<Ctx | null>(null);

const MUTE_KEY = "message_banner_muted";
const MAX_BANNERS = 3;

export function MessageBannerProvider({ children }: { children: React.ReactNode }) {
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(MUTE_KEY) === "1";
  });

  const push = useCallback((b: BannerItem) => {
    setBanners((prev) => {
      if (prev.some((p) => p.id === b.id)) return prev;
      const next = [...prev, b];
      // keep only newest MAX_BANNERS
      return next.slice(-MAX_BANNERS);
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try { localStorage.setItem(MUTE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ banners, push, dismiss, muted, toggleMuted }), [banners, push, dismiss, muted, toggleMuted]);

  return <MessageBannerContext.Provider value={value}>{children}</MessageBannerContext.Provider>;
}

export function useMessageBanner() {
  const ctx = useContext(MessageBannerContext);
  if (!ctx) throw new Error("useMessageBanner must be used inside MessageBannerProvider");
  return ctx;
}

/** Plays a short soft "ding" using WebAudio. No-ops if muted or unsupported. */
export function playBannerSound() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.28);
    setTimeout(() => ctx.close().catch(() => {}), 400);
  } catch {
    // ignore
  }
}
