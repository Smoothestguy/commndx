import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getPathFromUrl } from '@/utils/signedUrlUtils';

/** One shared lookup per view session, never one metadata request per avatar. */
export function useOptimizedPhoto(bucket: string, photo: string | null | undefined, thumbnail = true) {
  const variants = useQuery({
    queryKey: ['image-optimizations'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const rows: { bucket_id: string; object_path: string; thumbnail_path: string | null; optimized_path: string | null }[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from('image_optimizations').select('bucket_id,object_path,thumbnail_path,optimized_path').range(offset, offset + 499);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 500) break;
      }
      return new Map(rows.map(row => [`${row.bucket_id}/${row.object_path}`, row]));
    },
  });
  if (!photo) return { photo, loading: false };
  const match = photo.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/);
  const actualBucket = match?.[1] ?? bucket;
  const path = match ? decodeURIComponent(match[2]) : getPathFromUrl(photo, bucket);
  const row = variants.data?.get(`${actualBucket}/${path}`);
  const variant = thumbnail ? row?.thumbnail_path : row?.optimized_path;
  if (!variant) return { photo, bucket: actualBucket, loading: variants.isLoading };
  return { photo: variant, bucket: actualBucket, loading: false };
}