import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";

export type ExpenseCategoryType = "vendor" | "personnel" | "both";

export interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  category_type: ExpenseCategoryType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useExpenseCategories = (type?: ExpenseCategoryType) => {
  return useQuery({
    queryKey: ["expense-categories", type],
    queryFn: async () => {
      let query = supabase
        .from("expense_categories")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (type) {
        query = query.or(`category_type.eq.${type},category_type.eq.both`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ExpenseCategory[];
    },
  });
};

export const useAddExpenseCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (category: Omit<ExpenseCategory, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("expense_categories")
        .insert([category])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      toast.success("Expense category added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add expense category: ${error.message}`);
    },
  });
};

export const useUpdateExpenseCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ExpenseCategory> & { id: string }) => {
      const { data, error } = await supabase
        .from("expense_categories")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      toast.success("Expense category updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update expense category: ${error.message}`);
    },
  });
};

export const useDeleteExpenseCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("expense_categories")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      toast.success("Expense category deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete expense category: ${error.message}`);
    },
  });
};
