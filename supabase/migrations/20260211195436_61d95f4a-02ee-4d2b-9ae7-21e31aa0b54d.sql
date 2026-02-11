
ALTER TABLE public.products
  ADD COLUMN qb_product_mapping_id uuid REFERENCES public.qb_product_service_mappings(id) ON DELETE SET NULL;
