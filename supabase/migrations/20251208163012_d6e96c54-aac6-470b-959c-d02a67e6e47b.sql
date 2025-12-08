-- Add address fields
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS zip text;

-- Add tax and 1099 tracking
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS tax_id text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS track_1099 boolean DEFAULT false;

-- Add billing and payment fields
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS billing_rate numeric;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS payment_terms text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS account_number text;

-- Add accounting fields
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS default_expense_category_id uuid REFERENCES public.expense_categories(id);
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS opening_balance numeric DEFAULT 0;

-- Add notes field
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS notes text;