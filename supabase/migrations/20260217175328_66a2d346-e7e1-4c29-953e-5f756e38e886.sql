
DROP POLICY IF EXISTS "Admins and managers can manage job orders" ON job_orders;
CREATE POLICY "Admins and managers can manage job orders" ON job_orders
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "Admins and managers can manage job order line items" ON job_order_line_items;
CREATE POLICY "Admins and managers can manage job order line items" ON job_order_line_items
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
