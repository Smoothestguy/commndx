import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { recomputeAttendanceFromVisits } from '@/integrations/supabase/hooks/useFieldMode';
import { ensureSheetsOpen, guardStayWeeks } from '@/lib/sheetLocks';
import { affectedStayDates } from '@/lib/stayEdits';
import { toast } from 'sonner';

export type StayChange = { id: string; inAt: string; outAt: string | null; remove: boolean; note?: string };
export function useEditedStayIds(ids: string[]) {
  const unique = [...new Set(ids)].sort();
  return useQuery({ queryKey: ['edited-stays', unique], enabled: unique.length > 0, queryFn: async () => {
    const edited = new Set<string>();
    for (let i = 0; i < unique.length; i += 200) {
      const { data, error } = await supabase.from('audit_logs').select('resource_id').eq('resource_type', 'visit_personnel').eq('action_type', 'stay_times_edit').eq('success', true).in('resource_id', unique.slice(i, i + 200));
      if (error) throw error;
      for (const r of data || []) if (r.resource_id) edited.add(r.resource_id);
    }
    return edited;
  } });
}
export function useEditStayTimes(projectId: string) {
  const qc = useQueryClient();
  const refresh = () => {
    for (const key of ['edited-stays','personnel-trail','week-timesheet','visit-notes','visits-window','today-visits','on-site-now','location-attendance','location-attendance-batch','time-entries','all-time-entries','deployment-hours','project-time-entries','project-roster','signin-sheet-days','signin-reconciliation']) qc.invalidateQueries({ queryKey: [key] });
  };
  return useMutation({
    mutationFn: async (changes: StayChange[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in required');
      const { data: roles, error: roleError } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      if (roleError) throw roleError;
      if (!roles?.some(r => r.role === 'admin' || r.role === 'manager')) throw new Error('Manager access required');
      const prepared = [];
      for (const change of changes) {
        if (!Number.isFinite(Date.parse(change.inAt)) || (change.outAt && (!Number.isFinite(Date.parse(change.outAt)) || Date.parse(change.outAt) <= Date.parse(change.inAt)))) throw new Error('Time out must be after time in');
        const { data: stay, error } = await supabase.from('visit_personnel').select('*').eq('id', change.id).single();
        if (error) throw error;
        const { data: visit, error: ve } = await supabase.from('location_visits').select('id,location_id,check_in_at,check_out_at').eq('id', stay.visit_id).single();
        if (ve) throw ve;
        const { data: location, error: le } = await supabase.from('project_locations').select('id,project_id,timezone').eq('id', visit.location_id).single();
        if (le) throw le;
        if (location.project_id !== projectId) throw new Error('Stay is not part of this project');
        const oldIn = stay.checked_in_at || visit.check_in_at, oldOut = stay.checked_out_at || visit.check_out_at;
        if (!change.remove && oldOut && !change.outAt) throw new Error('A closed stay needs a time out');
        const zone = location.timezone || 'America/Chicago';
        prepared.push({ ...change, stay, locationId: location.id, oldIn, oldOut, zone, dates: affectedStayDates(oldIn, oldOut, change.inAt, change.outAt, zone) });
      }
      await guardStayWeeks(projectId, prepared);
      await ensureSheetsOpen(prepared.map(s => ({ locationId: s.locationId, dates: s.dates })));
      // Check again after waiting for an explicit sheet-reopen decision.
      await guardStayWeeks(projectId, prepared);
      let saved = 0;
      try {
        for (const s of prepared) {
          const before = { checked_in_at: s.oldIn, checked_out_at: s.oldOut, signature_url: s.stay.signature_url, signed_at: s.stay.signed_at, visit_id: s.stay.visit_id, personnel_id: s.stay.personnel_id };
          const after = s.remove ? { removed: true, ...(s.note ? { note: s.note } : {}) } : { checked_in_at: s.inAt, checked_out_at: s.outAt, ...(s.note ? { note: s.note } : {}) };
          const { data: linkedEntries, error: linkedError } = await supabase.from('time_entries').select('id').eq('visit_personnel_id', s.id);
          if (linkedError) throw linkedError;
          const { data: audit, error: ae } = await supabase.from('audit_logs').insert({ user_id: user.id, user_email: user.email || 'unknown', action_type: s.remove ? 'stay_delete' : 'stay_times_edit', resource_type: 'visit_personnel', resource_id: s.id, changes_before: before, changes_after: after, metadata: { project_id: projectId, location_id: s.locationId }, success: false }).select('id').single();
          if (ae) throw ae;
          let query = s.remove ? supabase.from('visit_personnel').delete() : supabase.from('visit_personnel').update({ checked_in_at: s.inAt, checked_out_at: s.outAt });
          query = query.eq('id', s.id);
          query = s.stay.checked_in_at ? query.eq('checked_in_at', s.stay.checked_in_at) : query.is('checked_in_at', null);
          query = s.stay.checked_out_at ? query.eq('checked_out_at', s.stay.checked_out_at) : query.is('checked_out_at', null);
          const { data: written, error: we } = await query.select('id');
          if (we) throw we;
          if (!written?.length) throw new Error('Stay changed; refresh and retry');
          saved++;
          const { error: completeError } = await supabase.from('audit_logs').insert({ user_id: user.id, user_email: user.email || 'unknown', action_type: s.remove ? 'stay_delete' : 'stay_times_edit', resource_type: 'visit_personnel', resource_id: s.id, changes_before: before, changes_after: after, metadata: { project_id: projectId, location_id: s.locationId, attempt_id: audit.id }, success: true });
          if (completeError) throw completeError;
          if (s.remove) {
            // The live FK nullifies visit_personnel_id on deletion; preserve the financial row,
            // but void its accrual instead of leaving detached billable hours behind.
            if (linkedEntries?.length) {
              const { error: te } = await supabase.from('time_entries').update({ status: 'approved', hours: 0, regular_hours: 0, overtime_hours: 0, billable: false, description: 'Removed site stay — history retained' }).in('id', linkedEntries.map(e => e.id)).or('is_locked.is.null,is_locked.eq.false').is('invoice_id', null);
              if (te) throw te;
            }
          }
        }
      } catch (e) {
        for (const scope of prepared) await recomputeAttendanceFromVisits(scope.locationId, scope.dates).catch(() => undefined);
        throw new Error(`${saved ? `${saved} stay(s) saved; remaining changes failed. ` : ''}${e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Unable to save changes'}`);
      }
      for (const locationId of new Set(prepared.map(s => s.locationId))) await recomputeAttendanceFromVisits(locationId, prepared.filter(s => s.locationId === locationId).flatMap(s => s.dates));
    },
    onSuccess: () => { refresh(); toast.success('Times updated'); },
    onError: (error) => { refresh(); toast.error(error.message); },
  });
}