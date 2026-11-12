import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useProjectDayPeople(projectId: string, enabled: boolean) {
  return useQuery({ queryKey: ['project-day-people', projectId], enabled, queryFn: async () => {
    const ids = new Set<string>();
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('personnel_project_assignments').select('personnel_id').eq('project_id', projectId).eq('active',true).order('id').range(offset, offset + 499);
      if (error) throw error;
      for (const row of data ?? []) ids.add(row.personnel_id);
      if ((data ?? []).length < 500) break;
    }
    const people: { personnel_id: string; first_name: string | null; last_name: string | null }[] = [];
    const keys = [...ids];
    for (let offset = 0; offset < keys.length; offset += 200) {
      const { data, error } = await supabase.from('personnel_directory').select('id,first_name,last_name').in('id', keys.slice(offset, offset + 200));
      if (error) throw error;
      for (const row of data ?? []) if (row.id) people.push({ personnel_id: row.id, first_name: row.first_name, last_name: row.last_name });
    }
    return people;
  }});
}