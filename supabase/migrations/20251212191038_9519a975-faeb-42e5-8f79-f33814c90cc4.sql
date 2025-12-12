-- Add vendor_cost column to change_order_line_items for dual pricing
ALTER TABLE public.change_order_line_items 
ADD COLUMN vendor_cost numeric NOT NULL DEFAULT 0;