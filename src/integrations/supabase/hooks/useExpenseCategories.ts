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

export interface ExpenseCategoryWithMapping extends ExpenseCategory {
  quickbooks_account_id: string | null;
  sync_status: string | null;
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

export const useExpenseCategoriesWithMapping = () => {
  return useQuery({
    queryKey: ["expense-categories-with-mapping"],
    queryFn: async () => {
      // Fetch categories
      const { data: categories, error: catError } = await supabase
        .from("expense_categories")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (catError) throw catError;

      // Fetch mappings
      const { data: mappings, error: mapError } = await supabase
        .from("quickbooks_account_mappings")
        .select("expense_category_id, quickbooks_account_id, sync_status");

      if (mapError) throw mapError;

      // Combine
      const mappingMap = new Map(
        mappings?.map((m) => [m.expense_category_id, m]) || []
      );

      return (categories || []).map((cat) => {
        const mapping = mappingMap.get(cat.id);
        return {
          ...cat,
          quickbooks_account_id: mapping?.quickbooks_account_id || null,
          sync_status: mapping?.sync_status || null,
        } as ExpenseCategoryWithMapping;
      });
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

// QuickBooks account for linking
export interface QuickBooksAccount {
  id: string;
  name: string;
  type: string;
  subType: string | null;
  isMapped: boolean;
}

// Fetch available QuickBooks accounts for manual linking
export const useQuickBooksAccounts = () => {
  return useQuery({
    queryKey: ["quickbooks-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('quickbooks-sync-accounts', {
        body: { action: 'list' },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to fetch accounts');
      return data.accounts as QuickBooksAccount[];
    },
  });
};

// Link a category to a QuickBooks account
export const useLinkCategoryToQuickBooks = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      categoryId, 
      qbAccountId, 
      qbAccountName, 
      qbAccountType,
      qbAccountSubType 
    }: { 
      categoryId: string; 
      qbAccountId: string; 
      qbAccountName: string; 
      qbAccountType: string;
      qbAccountSubType?: string | null;
    }) => {
      const { error } = await supabase
        .from('quickbooks_account_mappings')
        .insert({
          expense_category_id: categoryId,
          quickbooks_account_id: qbAccountId,
          quickbooks_account_name: qbAccountName,
          quickbooks_account_type: qbAccountType,
          quickbooks_account_subtype: qbAccountSubType || null,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories-with-mapping"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-accounts"] });
      toast.success("Category linked to QuickBooks");
    },
    onError: (error: Error) => {
      toast.error(`Failed to link category: ${error.message}`);
    },
  });
};

// Unlink a category from QuickBooks
export const useUnlinkCategoryFromQuickBooks = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await supabase
        .from('quickbooks_account_mappings')
        .delete()
        .eq('expense_category_id', categoryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories-with-mapping"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-accounts"] });
      toast.success("Category unlinked from QuickBooks");
    },
    onError: (error: Error) => {
      toast.error(`Failed to unlink category: ${error.message}`);
    },
  });
};
