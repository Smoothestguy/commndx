-- Allow personnel to update their own record (for photo_url)
CREATE POLICY "Personnel can update own record" ON personnel
FOR UPDATE USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());