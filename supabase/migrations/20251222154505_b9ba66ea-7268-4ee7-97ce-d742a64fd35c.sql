-- Create table to store multiple attachments per addendum
CREATE TABLE public.po_addendum_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addendum_id UUID NOT NULL REFERENCES public.po_addendums(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.po_addendum_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins and managers can manage addendum attachments"
ON public.po_addendum_attachments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Authenticated users can view addendum attachments"
ON public.po_addendum_attachments
FOR SELECT
USING (true);

CREATE POLICY "Vendors can view their PO addendum attachments"
ON public.po_addendum_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.po_addendums pa
    JOIN public.purchase_orders po ON pa.purchase_order_id = po.id
    WHERE pa.id = po_addendum_attachments.addendum_id
    AND po.vendor_id = get_vendor_id_for_user(auth.uid())
  )
);