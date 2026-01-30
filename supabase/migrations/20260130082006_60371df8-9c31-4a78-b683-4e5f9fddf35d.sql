-- ============================================================================
-- CRITICAL DATABASE SECURITY HARDENING MIGRATION - PART 2 (CORRECTED)
-- Fixes remaining tables (skips non-existent tables)
-- ============================================================================

-- Job postings
DROP POLICY IF EXISTS "Staff can view job postings" ON job_postings;
DROP POLICY IF EXISTS "Authenticated users can view job postings" ON job_postings;
CREATE POLICY "Staff can view job postings"
ON job_postings FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));

-- Application notes
DROP POLICY IF EXISTS "Staff can view application notes" ON application_notes;
DROP POLICY IF EXISTS "Authenticated users can view application notes" ON application_notes;
CREATE POLICY "Staff can view application notes"
ON application_notes FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));

-- Application revisions
DROP POLICY IF EXISTS "Staff can view application revisions" ON application_revisions;
DROP POLICY IF EXISTS "Authenticated users can view application revisions" ON application_revisions;
CREATE POLICY "Staff can view application revisions"
ON application_revisions FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));

-- Application form templates
DROP POLICY IF EXISTS "Staff can view application form templates" ON application_form_templates;
DROP POLICY IF EXISTS "Authenticated users can view application form templates" ON application_form_templates;
CREATE POLICY "Staff can view application form templates"
ON application_form_templates FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));

-- Audit logs
DROP POLICY IF EXISTS "Staff can view audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Authenticated users can view audit logs" ON audit_logs;
CREATE POLICY "Staff can view audit logs"
ON audit_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));

-- Dashboard configurations
DROP POLICY IF EXISTS "Staff can view dashboard configurations" ON dashboard_configurations;
DROP POLICY IF EXISTS "Authenticated users can view dashboard configurations" ON dashboard_configurations;
CREATE POLICY "Staff can view dashboard configurations"
ON dashboard_configurations FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));

-- Integration settings
DROP POLICY IF EXISTS "Staff can view integration settings" ON integration_settings;
DROP POLICY IF EXISTS "Authenticated users can view integration settings" ON integration_settings;
CREATE POLICY "Staff can view integration settings"
ON integration_settings FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));

-- Project assignments
DROP POLICY IF EXISTS "Staff can view project assignments" ON project_assignments;
DROP POLICY IF EXISTS "Authenticated users can view project assignments" ON project_assignments;
CREATE POLICY "Staff can view project assignments"
ON project_assignments FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));

-- Geocode logs
DROP POLICY IF EXISTS "Staff can view geocode logs" ON geocode_logs;
DROP POLICY IF EXISTS "Authenticated users can view geocode logs" ON geocode_logs;
CREATE POLICY "Staff can view geocode logs"
ON geocode_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));

-- Admin notifications
DROP POLICY IF EXISTS "Staff can view admin notifications" ON admin_notifications;
DROP POLICY IF EXISTS "Authenticated users can view admin notifications" ON admin_notifications;
CREATE POLICY "Staff can view admin notifications"
ON admin_notifications FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));

-- Entity merge audit
DROP POLICY IF EXISTS "Staff can view entity merge audit" ON entity_merge_audit;
DROP POLICY IF EXISTS "Authenticated users can view entity merge audit" ON entity_merge_audit;
CREATE POLICY "Staff can view entity merge audit"
ON entity_merge_audit FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));

-- Assignment removal log
DROP POLICY IF EXISTS "Staff can view assignment removal log" ON assignment_removal_log;
DROP POLICY IF EXISTS "Authenticated users can view assignment removal log" ON assignment_removal_log;
CREATE POLICY "Staff can view assignment removal log"
ON assignment_removal_log FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));

-- Contractor submissions
DROP POLICY IF EXISTS "Staff can view contractor submissions" ON contractor_submissions;
DROP POLICY IF EXISTS "Authenticated users can view contractor submissions" ON contractor_submissions;
CREATE POLICY "Staff can view contractor submissions"
ON contractor_submissions FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));

-- Dev activities
DROP POLICY IF EXISTS "Staff can view dev activities" ON dev_activities;
DROP POLICY IF EXISTS "Authenticated users can view dev activities" ON dev_activities;
CREATE POLICY "Staff can view dev activities"
ON dev_activities FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));

-- User work sessions
DROP POLICY IF EXISTS "Staff can view user work sessions" ON user_work_sessions;
DROP POLICY IF EXISTS "Authenticated users can view user work sessions" ON user_work_sessions;
CREATE POLICY "Staff can view user work sessions"
ON user_work_sessions FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));

-- AI dev conversations
DROP POLICY IF EXISTS "Staff can view ai dev conversations" ON ai_dev_conversations;
DROP POLICY IF EXISTS "Authenticated users can view ai dev conversations" ON ai_dev_conversations;
CREATE POLICY "Staff can view ai dev conversations"
ON ai_dev_conversations FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));

-- AI dev messages
DROP POLICY IF EXISTS "Staff can view ai dev messages" ON ai_dev_messages;
DROP POLICY IF EXISTS "Authenticated users can view ai dev messages" ON ai_dev_messages;
CREATE POLICY "Staff can view ai dev messages"
ON ai_dev_messages FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));

-- Conversations
DROP POLICY IF EXISTS "Staff can view conversations" ON conversations;
DROP POLICY IF EXISTS "Authenticated users can view conversations" ON conversations;
CREATE POLICY "Staff can view conversations"
ON conversations FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));

-- Conversation messages
DROP POLICY IF EXISTS "Staff can view conversation messages" ON conversation_messages;
DROP POLICY IF EXISTS "Authenticated users can view conversation messages" ON conversation_messages;
CREATE POLICY "Staff can view conversation messages"
ON conversation_messages FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));

-- Conversation participants
DROP POLICY IF EXISTS "Staff can view conversation participants" ON conversation_participants;
DROP POLICY IF EXISTS "Authenticated users can view conversation participants" ON conversation_participants;
CREATE POLICY "Staff can view conversation participants"
ON conversation_participants FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));

-- ============================================================================
-- PHASE 4: SPECIAL CASES
-- ============================================================================

-- Applicants: Remove public read, keep public insert
DROP POLICY IF EXISTS "Staff can view applicants" ON applicants;
DROP POLICY IF EXISTS "Public can check applicant by email" ON applicants;

CREATE POLICY "Staff can view applicants"
ON applicants FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));

-- Applications: Same treatment
DROP POLICY IF EXISTS "Staff can view applications" ON applications;
DROP POLICY IF EXISTS "Public can check own applications by applicant_id" ON applications;

CREATE POLICY "Staff can view applications"
ON applications FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'user'));