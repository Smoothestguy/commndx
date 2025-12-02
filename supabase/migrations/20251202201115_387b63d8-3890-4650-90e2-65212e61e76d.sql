-- Add DELETE policy for admins and managers on time_entries
CREATE POLICY "Admins and managers can delete all time entries"
ON public.time_entries
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- Add UPDATE policy for admins and managers on time_entries
CREATE POLICY "Admins and managers can update all time entries"
ON public.time_entries
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
);