import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { decodeImage, encodeImage } from './codec.ts';
import { service, authorize, json } from '../_shared/signinJobs.ts';
import { authenticateCronRequest } from '../_shared/cron-auth.ts';
import { imageEligible, imageDimensions, JPEG_QUALITY, THUMBNAIL_SIZE } from '../_shared/imagePolicy.ts';

const schema = z.object({ limit: z.number().int().min(1).max(25).default(10), dry_run: z.boolean().default(false) }).strict();
const hash = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(b => b.toString(16).padStart(2, '0')).join('');

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const db = service();
    const auth = await authorize(req, db);
    if (!auth && authenticateCronRequest(req)) return json({ error: 'Unauthorized' }, 403);
    const input = schema.safeParse(await req.json());
    if (!input.success) return json({ error: input.error.flatten() }, 400);
    const candidates = await db.rpc('image_compression_candidates', { p_limit: input.data.limit });
    if (candidates.error) throw candidates.error;
    if (input.data.dry_run) return json({ dry_run: true, eligible: candidates.data.length, bytes: candidates.data.reduce((s: number, r: { bytes: number }) => s + Number(r.bytes), 0) });
    let processed = 0, originalBytes = 0, optimizedBytes = 0, thumbnailBytes = 0;
    const failures: string[] = [];
    for (const row of candidates.data.slice(0, 1)) {
      if (!imageEligible(row.bucket_id, row.object_path, row.mime)) continue;
      try {
        const bucket = db.storage.from(row.bucket_id);
        const source = await bucket.download(row.object_path);
        if (source.error || !source.data) throw source.error ?? new Error('Download failed');
        const bytes = new Uint8Array(await source.data.arrayBuffer());
        const digest = await hash(bytes);
        const image = decodeImage(bytes);
        if (image.width * image.height > 12_000_000) throw new Error('Image too large for safe processing');
        const [width, height] = imageDimensions(image.width, image.height);
        image.resize('nearest', width, height);
        const thumbnail = image.clone();
        const side = Math.min(thumbnail.width, thumbnail.height);
        thumbnail.crop('box', Math.floor((thumbnail.width - side) / 2), Math.floor((thumbnail.height - side) / 2), side, side).resize('nearest', THUMBNAIL_SIZE, THUMBNAIL_SIZE);
        const thumb = encodeImage(thumbnail, JPEG_QUALITY);
        const compressed = encodeImage(image, JPEG_QUALITY);
        const thumbPath = `${row.object_path}.thumb.jpg`;
        // Receipt originals remain accounting evidence. Only their viewing copy changes.
        const receipt = row.bucket_id === 'document-attachments';
        const optimizedPath = receipt ? `${row.object_path}.optimized.jpg` : row.object_path;
        const thumbUpload = await bucket.upload(thumbPath, thumb, { contentType: 'image/jpeg', upsert: true });
        if (thumbUpload.error) throw thumbUpload.error;
        let savedBytes = bytes.length;
        if (compressed.length < bytes.length) {
          const write = await bucket.upload(optimizedPath, compressed, { contentType: 'image/jpeg', upsert: true });
          if (write.error) throw write.error;
          // Verify the stored bytes before recording completion.
          const signed = await bucket.createSignedUrl(optimizedPath, 60);
          if (signed.error || !signed.data) throw new Error('Stored image verification failed');
          const read = await fetch(`${signed.data.signedUrl}&verify=${crypto.randomUUID()}`, { cache: 'no-store' });
          if (!read.ok || await hash(new Uint8Array(await read.arrayBuffer())) !== await hash(compressed)) throw new Error('Stored image verification failed');
          savedBytes = compressed.length;
        }
        const record = await db.from('image_optimizations').upsert({ bucket_id: row.bucket_id, object_path: row.object_path, thumbnail_path: thumbPath, optimized_path: receipt && compressed.length < bytes.length ? optimizedPath : null, original_bytes: bytes.length, optimized_bytes: savedBytes, thumbnail_bytes: thumb.length, original_sha256: digest });
        if (record.error) throw record.error;
        processed++; originalBytes += bytes.length; optimizedBytes += receipt ? bytes.length + (compressed.length < bytes.length ? compressed.length : 0) : savedBytes; thumbnailBytes += thumb.length;
      } catch (error) {
        failures.push(error instanceof Error ? error.message : 'Image failed');
      }
    }
    return json({ processed, original_bytes: originalBytes, stored_image_bytes: optimizedBytes, thumbnail_bytes: thumbnailBytes, net_bytes_saved: originalBytes - optimizedBytes - thumbnailBytes, failures });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Compression failed' }, 500); }
});