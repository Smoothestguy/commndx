
-- Add missing columns to project_rooms
ALTER TABLE public.project_rooms ADD COLUMN IF NOT EXISTS shower_size TEXT;
ALTER TABLE public.project_rooms ADD COLUMN IF NOT EXISTS ceiling_height INTEGER;

-- Add scope_code and scope_description to room_scope_items for display purposes
ALTER TABLE public.room_scope_items ADD COLUMN IF NOT EXISTS scope_code TEXT;
ALTER TABLE public.room_scope_items ADD COLUMN IF NOT EXISTS scope_description TEXT;
