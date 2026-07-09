import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MyBankingInfo {
  bank_name: string | null;
  bank_account_type: string | null;
  bank_account_last4: string | null;
  banking_info_updated_at: string | null;
}

export function useMyBankingInfo() {
  return useQuery<MyBankingInfo | null>({
    queryKey: ["my-banking"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_my_banking_info");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as MyBankingInfo) ?? null;
    },
  });
}

export interface UpdateMyBankingInput {
  bank_name: string;
  account_type: "checking" | "savings";
  routing_number: string;
  account_number: string;
}

export function useUpdateMyBankingInfo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateMyBankingInput) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("update_my_banking_info", {
        _bank_name: input.bank_name,
        _account_type: input.account_type,
        _routing: input.routing_number,
        _account: input.account_number,
      });
      if (error) throw error;
      return data as { success: boolean; bank_account_last4: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-banking"] });
      toast.success("Banking information saved");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to save banking info";
      toast.error(msg);
    },
  });
}
