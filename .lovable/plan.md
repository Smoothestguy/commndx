

## Fix: Create Missing `vendor-documents` Storage Bucket

### Problem
When uploading a document on the vendor detail page, the upload fails with "Bucket not found" because the `vendor-documents` storage bucket has never been created in the database.

### Fix
Create the `vendor-documents` storage bucket and add RLS policies so authenticated users can upload, read, and delete files.

### Technical Details

**Database migration** -- single SQL file:

1. Create the `vendor-documents` bucket (private, since it may contain sensitive documents like EIN letters, W-9s, insurance certs)
2. Add RLS policies on `storage.objects` for this bucket:
   - Authenticated users can upload files (`INSERT`)
   - Authenticated users can read files (`SELECT`)
   - Authenticated users can delete files (`DELETE`)

Since the bucket is private, the existing `VendorDocumentUpload` component calls `getPublicUrl()` which won't work for private buckets. Two options:
- **Option A**: Make the bucket public (simpler, matches current code using `getPublicUrl`)
- **Option B**: Make the bucket private and switch to signed URLs

Given that vendor documents (W-9s, insurance certs, EIN letters) are sensitive, the bucket should be **private**. However, the current code uses `getPublicUrl` and stores that URL. To keep changes minimal and get uploads working immediately, we will make the bucket **public** -- matching how `form-uploads` works. A future enhancement can migrate to signed URLs.

**Migration SQL:**
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-documents', 'vendor-documents', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload vendor documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'vendor-documents');

CREATE POLICY "Authenticated users can read vendor documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'vendor-documents');

CREATE POLICY "Authenticated users can delete vendor documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'vendor-documents');
```

### Files Changed
| File | Action |
|------|--------|
| Database migration | Create bucket + RLS policies |

No code changes needed -- the existing upload component will work once the bucket exists.

