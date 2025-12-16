-- RLS policy for vendors to view PO addendum line items (corrected column name)
CREATE POLICY "Vendors can view own PO addendum line items"
ON public.po_addendum_line_items FOR SELECT
USING (
  po_addendum_id IN (
    SELECT pa.id FROM public.po_addendums pa
    JOIN public.purchase_orders po ON pa.purchase_order_id = po.id
    WHERE po.vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
  )
);