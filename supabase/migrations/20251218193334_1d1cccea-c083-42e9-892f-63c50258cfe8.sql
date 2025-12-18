-- Allow anonymous users to view task orders that have open job postings
CREATE POLICY "Public can view task orders with open job postings" 
ON public.project_task_orders
FOR SELECT
USING (
  id IN (
    SELECT task_order_id FROM job_postings WHERE is_open = true
  )
);

-- Allow anonymous users to view projects that have task orders with open job postings
CREATE POLICY "Public can view projects with open job postings"
ON public.projects
FOR SELECT
TO public
USING (
  id IN (
    SELECT project_id FROM project_task_orders 
    WHERE id IN (
      SELECT task_order_id FROM job_postings WHERE is_open = true
    )
  )
);