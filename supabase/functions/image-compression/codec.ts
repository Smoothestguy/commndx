// Load only JPEG/PNG codecs, not ImageScript's font, SVG, GIF and TIFF WASM modules.
import * as jpeg from 'https://deno.land/x/imagescript@1.3.0/utils/wasm/jpeg.js';
import * as png from 'https://deno.land/x/imagescript@1.3.0/utils/wasm/png.js';
import Frame from 'https://deno.land/x/imagescript@1.3.0/v2/framebuffer.mjs';

export function decodeImage(bytes: Uint8Array) {
  if (bytes[0] === 137 && bytes[1] === 80) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(16) * view.getUint32(20) > 6_000_000) throw new Error('PNG exceeds safe decode size');
    const result = png.decode(bytes);
    return new Frame(result.width, result.height, result.framebuffer);
  }
  // libjpeg scales during decoding, avoiding a full-resolution bitmap allocation.
  const result = jpeg.decode(bytes, 800, 800);
  const pixels = new Uint8Array(result.width * result.height * 4);
  pixels.fill(255);
  for (let i = 0; i < result.width * result.height; i++) {
    if (result.format === 0) pixels.set([result.buffer[i], result.buffer[i], result.buffer[i]], i * 4);
    else if (result.format === 1) pixels.set(result.buffer.subarray(i * 3, i * 3 + 3), i * 4);
    else throw new Error('Unsupported JPEG color format');
  }
  return new Frame(result.width, result.height, pixels);
}
export function encodeImage(frame: InstanceType<typeof Frame>, quality: number): Uint8Array {
  return jpeg.encode(frame.u8, frame.width, frame.height, quality);
}