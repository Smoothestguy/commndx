/** Remove pad paper at export time; stored evidence is never modified. */
export function clearWhitePixels(pixels: Uint8ClampedArray, threshold = 235) {
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] > threshold && pixels[i + 1] > threshold && pixels[i + 2] > threshold) pixels[i + 3] = 0;
  }
  return pixels;
}
/** Bounding box of visible ink (alpha > 16), padded; null when the image is blank. */
export function inkBounds(pixels: Uint8ClampedArray, width: number, height: number, pad = 4) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (pixels[(y * width + x) * 4 + 3] > 16) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxX < 0) return null;
  const x = Math.max(0, minX - pad), y = Math.max(0, minY - pad);
  return { x, y, width: Math.min(width, maxX + pad + 1) - x, height: Math.min(height, maxY + pad + 1) - y };
}
/** Export-only: strip paper to transparent and crop to the ink so small cells show a legible signature. */
export async function stripWhiteBackground(png: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const blob = new Blob([new Uint8Array(png)], { type: 'image/png' });
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Signature image processing unavailable');
    ctx.drawImage(bitmap, 0, 0);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    clearWhitePixels(image.data); ctx.putImageData(image, 0, 0);
    const box = inkBounds(image.data, canvas.width, canvas.height);
    let out = canvas;
    if (box && (box.width < canvas.width || box.height < canvas.height)) {
      out = document.createElement('canvas'); out.width = box.width; out.height = box.height;
      const octx = out.getContext('2d'); if (!octx) throw new Error('Signature image processing unavailable');
      octx.drawImage(canvas, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
    }
    const result = await new Promise<Blob>((resolve, reject) => out.toBlob(b => b ? resolve(b) : reject(new Error('Signature conversion failed')), 'image/png'));
    return new Uint8Array(await result.arrayBuffer());
  } finally { bitmap.close(); }
}
/** Shared cell placement: scale to `fill` (default 90%) of the cell, keep aspect ratio, center both axes.
 * Coordinate-origin agnostic (works for top-left jsPDF and bottom-left pdf-lib) and never exceeds the cell. */
export function fitSignatureInCell(cell: { x: number; y: number; width: number; height: number }, img: { width: number; height: number }, fill = 0.9) {
  if (!(cell.width > 0 && cell.height > 0 && img.width > 0 && img.height > 0)) return { x: cell.x, y: cell.y, width: 0, height: 0 };
  const scale = Math.min((cell.width * fill) / img.width, (cell.height * fill) / img.height);
  const width = img.width * scale, height = img.height * scale;
  return { x: cell.x + (cell.width - width) / 2, y: cell.y + (cell.height - height) / 2, width, height };
}
