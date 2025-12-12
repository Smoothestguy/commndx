-- Add enum for change type
CREATE TYPE public.change_type AS ENUM ('additive', 'deductive');

-- Add change_type column to change_orders
ALTER TABLE public.change_orders 
ADD COLUMN change_type public.change_type NOT NULL DEFAULT 'additive';

-- Add change_type column to tm_tickets
ALTER TABLE public.tm_tickets 
ADD COLUMN change_type public.change_type NOT NULL DEFAULT 'additive';