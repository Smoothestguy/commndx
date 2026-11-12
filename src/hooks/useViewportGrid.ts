import { useLayoutEffect, useRef } from 'react';

/** Size an opted-in desktop grid from its actual position, including trailing controls. */
export function useViewportGrid(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const grid = ref.current;
    if (!enabled || !grid) return;
    const media = window.matchMedia('(min-width: 1180px)');
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!media.matches || grid.offsetParent === null || grid.dataset.fullscreen === 'true') {
          grid.style.removeProperty('--viewport-grid-height');
          return;
        }
        const root = grid.closest('[data-viewport-list]');
        const grids = root ? Array.from(root.querySelectorAll<HTMLElement>('[data-viewport-grid="true"]')).filter(el => el.offsetParent !== null) : [grid];
        const index = grids.indexOf(grid);
        // Multiple Event grids share the available region rather than pushing the page down.
        const top = grids[0]?.getBoundingClientRect().top ?? grid.getBoundingClientRect().top;
        const last = grids[grids.length - 1];
        let trailing = 0;
        if (root && last) {
          let node: Element | null = last;
          while (node && node !== root) {
            let sibling = node.nextElementSibling;
            while (sibling) {
              const el = sibling as HTMLElement;
              if (el.offsetParent !== null && !el.matches('[role="dialog"],[data-viewport-grid]')) trailing += el.getBoundingClientRect().height + 8;
              sibling = sibling.nextElementSibling;
            }
            node = node.parentElement;
          }
        }
        const available = window.innerHeight - top - trailing - 16 - Math.max(0, grids.length - 1) * 40;
        if (index >= 0) grid.style.setProperty('--viewport-grid-height', `${Math.max(120, Math.floor(available / Math.max(1, grids.length)))}px`);
      });
    };
    const observer = new ResizeObserver(measure);
    const root = grid.closest('[data-viewport-list]') ?? grid.parentElement;
    if (root) {
      observer.observe(root);
      root.querySelectorAll('*').forEach(el => { if (!grid.contains(el) && !el.closest('[data-viewport-grid]')) observer.observe(el); });
    }
    window.addEventListener('resize', measure);
    media.addEventListener('change', measure);
    measure();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', measure); media.removeEventListener('change', measure); };
  }, [enabled]);
  return ref;
}