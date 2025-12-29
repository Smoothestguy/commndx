import { useQuery } from "@tanstack/react-query";
import { supabase } from "../client";

// Labor-related expense category names
const LABOR_CATEGORY_NAMES = ['Direct Labor', 'Contract Labor', 'Admin Labor'];

export interface ExpensesByProject {
  project_id: string;
  project_name: string;
  vendor_total: number;
  vendor_labor_total: number;
  vendor_other_total: number;
  personnel_total: number;
  total: number;
}

export interface ExpensesByCategory {
  category_id: string;
  category_name: string;
  vendor_total: number;
  personnel_total: number;
  total: number;
}

export interface ExpenseSummary {
  total_vendor_bills: number;
  total_personnel_payments: number;
  total_expenses: number;
  open_bills_count: number;
  paid_bills_count: number;
  pending_payments: number;
}

export const useExpensesByProject = (projectId: string | undefined) => {
  return useQuery({
    queryKey: ["expenses-by-project", projectId],
    queryFn: async () => {
      if (!projectId) return null;

      // Get vendor bill line items for this project
      const { data: vendorItems, error: vendorError } = await supabase
        .from("vendor_bill_line_items")
        .select("total, category_id, expense_categories(name)")
        .eq("project_id", projectId);

      if (vendorError) throw vendorError;

      // Get personnel payment allocations for this project
      const { data: personnelItems, error: personnelError } = await supabase
        .from("personnel_payment_allocations")
        .select("amount, personnel_payments(category_id, expense_categories(name))")
        .eq("project_id", projectId);

      if (personnelError) throw personnelError;

      // Group by category
      const byCategory: Record<string, { name: string; vendor: number; personnel: number }> = {};

      let vendorLaborTotal = 0;
      let vendorOtherTotal = 0;

      vendorItems.forEach((item: any) => {
        const catId = item.category_id || "uncategorized";
        const catName = item.expense_categories?.name || "Uncategorized";
        if (!byCategory[catId]) {
          byCategory[catId] = { name: catName, vendor: 0, personnel: 0 };
        }
        byCategory[catId].vendor += Number(item.total);

        // Separate labor vs other vendor expenses
        if (LABOR_CATEGORY_NAMES.includes(catName)) {
          vendorLaborTotal += Number(item.total);
        } else {
          vendorOtherTotal += Number(item.total);
        }
      });

      personnelItems.forEach((item: any) => {
        const catId = item.personnel_payments?.category_id || "uncategorized";
        const catName = item.personnel_payments?.expense_categories?.name || "Uncategorized";
        if (!byCategory[catId]) {
          byCategory[catId] = { name: catName, vendor: 0, personnel: 0 };
        }
        byCategory[catId].personnel += Number(item.amount);
      });

      const vendorTotal = vendorItems.reduce((sum, item: any) => sum + Number(item.total), 0);
      const personnelTotal = personnelItems.reduce((sum, item: any) => sum + Number(item.amount), 0);

      return {
        vendor_total: vendorTotal,
        vendor_labor_total: vendorLaborTotal,
        vendor_other_total: vendorOtherTotal,
        personnel_total: personnelTotal,
        total: vendorTotal + personnelTotal,
        by_category: Object.entries(byCategory).map(([id, data]) => ({
          category_id: id,
          category_name: data.name,
          vendor_total: data.vendor,
          personnel_total: data.personnel,
          total: data.vendor + data.personnel,
        })),
      };
    },
    enabled: !!projectId,
  });
};

export const useExpensesByCategory = (startDate?: string, endDate?: string) => {
  return useQuery({
    queryKey: ["expenses-by-category", startDate, endDate],
    queryFn: async () => {
      // Get vendor bills with categories
      let vendorQuery = supabase
        .from("vendor_bill_line_items")
        .select("total, category_id, expense_categories(name), vendor_bills!inner(bill_date)");

      if (startDate) {
        vendorQuery = vendorQuery.gte("vendor_bills.bill_date", startDate);
      }
      if (endDate) {
        vendorQuery = vendorQuery.lte("vendor_bills.bill_date", endDate);
      }

      const { data: vendorItems, error: vendorError } = await vendorQuery;
      if (vendorError) throw vendorError;

      // Get personnel payments with categories
      let personnelQuery = supabase
        .from("personnel_payments")
        .select("gross_amount, category_id, expense_categories(name), payment_date");

      if (startDate) {
        personnelQuery = personnelQuery.gte("payment_date", startDate);
      }
      if (endDate) {
        personnelQuery = personnelQuery.lte("payment_date", endDate);
      }

      const { data: personnelItems, error: personnelError } = await personnelQuery;
      if (personnelError) throw personnelError;

      // Group by category
      const byCategory: Record<string, { name: string; vendor: number; personnel: number }> = {};

      vendorItems.forEach((item: any) => {
        const catId = item.category_id || "uncategorized";
        const catName = item.expense_categories?.name || "Uncategorized";
        if (!byCategory[catId]) {
          byCategory[catId] = { name: catName, vendor: 0, personnel: 0 };
        }
        byCategory[catId].vendor += Number(item.total);
      });

      personnelItems.forEach((item: any) => {
        const catId = item.category_id || "uncategorized";
        const catName = item.expense_categories?.name || "Uncategorized";
        if (!byCategory[catId]) {
          byCategory[catId] = { name: catName, vendor: 0, personnel: 0 };
        }
        byCategory[catId].personnel += Number(item.gross_amount);
      });

      return Object.entries(byCategory).map(([id, data]) => ({
        category_id: id,
        category_name: data.name,
        vendor_total: data.vendor,
        personnel_total: data.personnel,
        total: data.vendor + data.personnel,
      })).sort((a, b) => b.total - a.total);
    },
  });
};

export const useExpenseSummary = (startDate?: string, endDate?: string) => {
  return useQuery({
    queryKey: ["expense-summary", startDate, endDate],
    queryFn: async () => {
      // Get vendor bills
      let vendorQuery = supabase.from("vendor_bills").select("total, status, bill_date");

      if (startDate) {
        vendorQuery = vendorQuery.gte("bill_date", startDate);
      }
      if (endDate) {
        vendorQuery = vendorQuery.lte("bill_date", endDate);
      }

      const { data: bills, error: billsError } = await vendorQuery;
      if (billsError) throw billsError;

      // Get personnel payments
      let personnelQuery = supabase.from("personnel_payments").select("gross_amount, payment_date");

      if (startDate) {
        personnelQuery = personnelQuery.gte("payment_date", startDate);
      }
      if (endDate) {
        personnelQuery = personnelQuery.lte("payment_date", endDate);
      }

      const { data: payments, error: paymentsError } = await personnelQuery;
      if (paymentsError) throw paymentsError;

      const totalVendor = bills.reduce((sum, bill: any) => sum + Number(bill.total), 0);
      const totalPersonnel = payments.reduce((sum, p: any) => sum + Number(p.gross_amount), 0);
      const openBills = bills.filter((b: any) => b.status === "open" || b.status === "partially_paid").length;
      const paidBills = bills.filter((b: any) => b.status === "paid").length;

      return {
        total_vendor_bills: totalVendor,
        total_personnel_payments: totalPersonnel,
        total_expenses: totalVendor + totalPersonnel,
        open_bills_count: openBills,
        paid_bills_count: paidBills,
        pending_payments: bills
          .filter((b: any) => b.status === "open" || b.status === "partially_paid")
          .reduce((sum, b: any) => sum + Number(b.total), 0),
      } as ExpenseSummary;
    },
  });
};
