-- Add vendor_id foreign key to personnel table
ALTER TABLE public.personnel 
ADD COLUMN vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_personnel_vendor_id ON public.personnel(vendor_id);