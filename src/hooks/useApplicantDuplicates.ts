import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from './useUserRole';
export interface ApplicantDuplicateGroup {
  group_key: string; match_type: string; applicant_ids: string[]; names: string[];
  emails: (string | null)[]; phones: (string | null)[];
}
export function useApplicantDuplicates() {
  const { isAdmin, isManager, isUser } = useUserRole();
  const query = useQuery({
    queryKey: ['duplicate-applicant-groups'], enabled: isAdmin || isManager || isUser,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('find_duplicate_applicant_groups');
      if (error) throw error;
      return (data ?? []) as ApplicantDuplicateGroup[];
    },
  });
  return { ...query, groupsFor: (id: string) => (query.data ?? []).filter(g => g.applicant_ids.includes(id)) };
}