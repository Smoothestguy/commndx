import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type MessageTemplate = Database["public"]["Tables"]["message_templates"]["Row"];
export type MessageTemplateInsert = Database["public"]["Tables"]["message_templates"]["Insert"];
export type MessageTemplateUpdate = Database["public"]["Tables"]["message_templates"]["Update"];

export function useMessageTemplates(includeInactive: boolean = false) {
  return useQuery({
    queryKey: ["message-templates", { includeInactive }],
    queryFn: async () => {
      let q = supabase.from("message_templates").select("*").order("category").order("sort_order");
      if (!includeInactive) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MessageTemplate[];
    },
  });
}

export function useUpsertMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: MessageTemplateInsert & { id?: string }) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { data, error } = await supabase
          .from("message_templates")
          .update(rest as MessageTemplateUpdate)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("message_templates")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["message-templates"] }),
  });
}

export function useDeleteMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("message_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["message-templates"] }),
  });
}
