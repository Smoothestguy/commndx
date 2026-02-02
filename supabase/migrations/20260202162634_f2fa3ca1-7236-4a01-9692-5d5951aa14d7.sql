-- =============================================
-- Phase 1: Critical RLS Security Hardening
-- Google Play Developer Content Policy Compliance
-- =============================================

-- 1. Secure QuickBooks OAuth tokens - only admins can access
DROP POLICY IF EXISTS "Authenticated users can view quickbooks config" ON public.quickbooks_config;
DROP POLICY IF EXISTS "authenticated_read_quickbooks" ON public.quickbooks_config;
DROP POLICY IF EXISTS "quickbooks_config_select" ON public.quickbooks_config;
DROP POLICY IF EXISTS "Only admins can view QuickBooks config" ON public.quickbooks_config;
DROP POLICY IF EXISTS "Only admins can insert QuickBooks config" ON public.quickbooks_config;
DROP POLICY IF EXISTS "Only admins can update QuickBooks config" ON public.quickbooks_config;
DROP POLICY IF EXISTS "Only admins can delete QuickBooks config" ON public.quickbooks_config;

CREATE POLICY "Only admins can view QuickBooks config"
  ON public.quickbooks_config FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can insert QuickBooks config"
  ON public.quickbooks_config FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update QuickBooks config"
  ON public.quickbooks_config FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete QuickBooks config"
  ON public.quickbooks_config FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Secure personnel table - restrict access to sensitive data (SSN, bank info)
DROP POLICY IF EXISTS "Authenticated users can view personnel" ON public.personnel;
DROP POLICY IF EXISTS "Personnel can view own record" ON public.personnel;
DROP POLICY IF EXISTS "Admins and managers can view all personnel" ON public.personnel;

-- Admins and managers can view all personnel
CREATE POLICY "Admins and managers can view all personnel"
  ON public.personnel FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- Personnel can view their own record
CREATE POLICY "Personnel can view own record"
  ON public.personnel FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 3. Secure emergency_contacts table - only allow self-access or admin/manager
DROP POLICY IF EXISTS "Authenticated users can view emergency contacts" ON public.emergency_contacts;
DROP POLICY IF EXISTS "Users can view emergency contacts" ON public.emergency_contacts;
DROP POLICY IF EXISTS "Admins and managers can view all emergency contacts" ON public.emergency_contacts;
DROP POLICY IF EXISTS "Personnel can view own emergency contacts" ON public.emergency_contacts;

CREATE POLICY "Admins and managers can view all emergency contacts"
  ON public.emergency_contacts FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Personnel can view own emergency contacts"
  ON public.emergency_contacts FOR SELECT
  TO authenticated
  USING (
    personnel_id = public.get_personnel_id_for_user(auth.uid())
  );

-- 4. Secure conversation_messages table - only participants can access
DROP POLICY IF EXISTS "Authenticated users can view messages" ON public.conversation_messages;
DROP POLICY IF EXISTS "Users can view conversation messages" ON public.conversation_messages;
DROP POLICY IF EXISTS "Participants can view conversation messages" ON public.conversation_messages;

CREATE POLICY "Participants can view conversation messages"
  ON public.conversation_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_messages.conversation_id
      AND (
        (cp.participant_type = 'user' AND cp.participant_id::uuid = auth.uid()) OR
        (cp.participant_type = 'personnel' AND cp.participant_id::uuid = public.get_personnel_id_for_user(auth.uid()))
      )
    ) OR
    public.has_role(auth.uid(), 'admin')
  );

-- 5. Secure conversations table - only participants can access
DROP POLICY IF EXISTS "Authenticated users can view conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view conversations" ON public.conversations;
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;

CREATE POLICY "Participants can view conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    (participant_1_type = 'user' AND participant_1_id::uuid = auth.uid()) OR
    (participant_2_type = 'user' AND participant_2_id::uuid = auth.uid()) OR
    (participant_1_type = 'personnel' AND participant_1_id::uuid = public.get_personnel_id_for_user(auth.uid())) OR
    (participant_2_type = 'personnel' AND participant_2_id::uuid = public.get_personnel_id_for_user(auth.uid())) OR
    public.has_role(auth.uid(), 'admin')
  );