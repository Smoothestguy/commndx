-- Add sort_order column to estimate_line_items table
ALTER TABLE public.estimate_line_items 
ADD COLUMN sort_order integer NOT NULL DEFAULT 0;