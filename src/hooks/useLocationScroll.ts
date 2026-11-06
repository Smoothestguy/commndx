import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
const positions = new Map<string, { window: number; grid: number }>();
/** Each history entry owns its position, including the nested desktop grid scroller. */
export function useLocationScroll(ready: boolean) {
  const location = useLocation();
  useLayoutEffect(() => {
    if (!ready) return;
    const saved = positions.get(location.key);
    const grid = document.querySelector<HTMLElement>('[data-location-grid-scroll]');
    if (saved) { window.scrollTo(0, saved.window); if (grid) grid.scrollTop = saved.grid; }
    const record = () => positions.set(location.key, { window: window.scrollY, grid: grid?.scrollTop ?? 0 });
    window.addEventListener('scroll', record, { passive: true });
    grid?.addEventListener('scroll', record, { passive: true });
    return () => { window.removeEventListener('scroll', record); grid?.removeEventListener('scroll', record); };
  }, [location.key, ready]);
}