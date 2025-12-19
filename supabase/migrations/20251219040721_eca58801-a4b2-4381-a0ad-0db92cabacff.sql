-- Add photo_url column to applicants table for profile pictures
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS photo_url TEXT;