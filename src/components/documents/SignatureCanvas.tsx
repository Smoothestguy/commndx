import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';

type Point = { x: number; y: number };
export type SignatureCanvasHandle = {
  clear: () => void;
  toDataURL: () => string;
  toBlob: (callback: BlobCallback) => void;
};

/** Normalized strokes survive layout/DPR changes; client coordinates are never cached. */
export const SignatureCanvas = forwardRef<SignatureCanvasHandle, {
  className?: string;
  onInkChange: (hasInk: boolean) => void;
  resetKey?: string;
}>(({ className = '', onInkChange, resetKey }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const activePointer = useRef<number | null>(null);
  const notify = useRef(onInkChange);
  notify.current = onInkChange;

  const paint = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('--signature-ink').trim();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 3 * canvas.width / Math.max(1, rect.width);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of strokes.current) {
      const first = stroke[0];
      if (!first) continue;
      ctx.beginPath();
      if (stroke.length === 1) {
        ctx.arc(first.x * canvas.width, first.y * canvas.height, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.moveTo(first.x * canvas.width, first.y * canvas.height);
        for (const point of stroke.slice(1)) ctx.lineTo(point.x * canvas.width, point.y * canvas.height);
        ctx.stroke();
      }
    }
  };

  const calibrate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      paint();
    }
  };

  const clear = () => {
    strokes.current = [];
    activePointer.current = null;
    paint();
    notify.current(false);
  };
  useImperativeHandle(ref, () => ({
    clear,
    toDataURL: () => canvasRef.current?.toDataURL('image/png') || '',
    toBlob: callback => canvasRef.current?.toBlob(callback, 'image/png'),
  }));

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    calibrate();
    const observer = new ResizeObserver(calibrate);
    observer.observe(canvas);
    window.addEventListener('resize', calibrate);
    window.addEventListener('orientationchange', calibrate);
    window.visualViewport?.addEventListener('resize', calibrate);
    const orientation = window.screen.orientation;
    orientation?.addEventListener('change', calibrate);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', calibrate);
      window.removeEventListener('orientationchange', calibrate);
      window.visualViewport?.removeEventListener('resize', calibrate);
      orientation?.removeEventListener('change', calibrate);
    };
  }, []);
  useEffect(clear, [resetKey]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    // Both client coordinates and the fresh rect are viewport-relative, even after scroll/zoom.
    calibrate();
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };
  const end = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <canvas ref={canvasRef} aria-label="Draw signature" className={`block touch-none select-none cursor-crosshair ${className}`}
    onPointerDown={event => {
      if (activePointer.current !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      activePointer.current = event.pointerId;
      strokes.current.push([point(event)]);
      paint();
      notify.current(true);
    }}
    onPointerMove={event => {
      if (activePointer.current !== event.pointerId) return;
      event.preventDefault();
      strokes.current[strokes.current.length - 1]?.push(point(event));
      paint();
    }}
    onPointerUp={end} onPointerCancel={end} onLostPointerCapture={() => { activePointer.current = null; }} />;
});
SignatureCanvas.displayName = 'SignatureCanvas';