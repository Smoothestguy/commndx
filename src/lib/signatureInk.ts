/** Remove pad paper at export time; stored evidence is never modified. */
export function clearWhitePixels(pixels: Uint8ClampedArray, threshold = 235) {
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] > threshold && pixels[i + 1] > threshold && pixels[i + 2] > threshold) pixels[i + 3] = 0;
  }
  return pixels;
}
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
    const result = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Signature conversion failed')), 'image/png'));
    return new Uint8Array(await result.arrayBuffer());
  } finally { bitmap.close(); }
}