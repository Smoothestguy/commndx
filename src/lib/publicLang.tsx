import { useSyncExternalStore } from 'react';

export type PublicLang = 'en' | 'es';
const KEY = 'frg-public-lang';
const listeners = new Set<() => void>();

/** Device language decides the default: Spanish for es-*, otherwise English (US). */
export function detectLang(langs: readonly string[] = typeof navigator === 'undefined' ? [] : (navigator.languages?.length ? navigator.languages : [navigator.language])): PublicLang {
  return (langs[0] || '').toLowerCase().startsWith('es') ? 'es' : 'en';
}
function initial(): PublicLang {
  if (typeof window === 'undefined') return 'en';
  const url = new URLSearchParams(window.location.search).get('lang');
  if (url === 'es' || url === 'en') return url;
  try { const s = sessionStorage.getItem(KEY); if (s === 'es' || s === 'en') return s; } catch { /* storage blocked */ }
  return detectLang();
}
let current: PublicLang = initial();

export function setPublicLang(lang: PublicLang) {
  current = lang;
  try { sessionStorage.setItem(KEY, lang); } catch { /* storage blocked */ }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  listeners.forEach(l => l());
}
/** Pick one half of a legacy "English / Español" string. */
export function pickLang(text: string, lang: PublicLang): string {
  const i = text.indexOf(' / ');
  if (i < 0) return text;
  return lang === 'es' ? text.slice(i + 3) : text.slice(0, i);
}

export function usePublicLang() {
  const lang = useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => current, () => 'en' as PublicLang);
  const tr = (en: string, es?: string) => (lang === 'es' && es ? es : en);
  return { lang, setLang: setPublicLang, tr, pick: (text: string) => pickLang(text, lang) };
}

export function LangSwitcher({ className = '' }: { className?: string }) {
  const { lang, setLang } = usePublicLang();
  return <div role="group" aria-label="Language / Idioma" className={`fixed top-3 right-3 z-50 flex rounded-md border border-border bg-background/80 text-xs font-semibold backdrop-blur ${className}`}>
    {(['en', 'es'] as const).map(l => <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => setLang(l)} className={`px-2.5 py-1.5 min-w-10 ${lang === l ? 'bg-primary text-primary-foreground rounded-md' : 'text-muted-foreground'}`}>{l.toUpperCase()}</button>)}
  </div>;
}
