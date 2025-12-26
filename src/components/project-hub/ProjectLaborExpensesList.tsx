import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, User } from "lucide-react";
import { usePersonnelPaymentsByProject } from "@/integrations/supabase/hooks/usePersonnelPayments";
import { EnhancedDataTable, EnhancedColumn } from "@/components/shared/EnhancedDataTable";
import { formatCurrency } from "@/lib/utils";
import { formatLocalDate } from "@/lib/dateUtils";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";

interface PaymentWithAllocation {
  id: string;
  payment: {
    id: string;
    number: string;
    personnel_id: string;
    personnel_name: string;
    payment_date: string;
    gross_amount: number;
    payment_type: string;
    notes: string | null;
  };
  allocated_amount: number;
}

interface ProjectLaborExpensesListProps {
  projectId: string;
}

const PAYMENT_TYPE_COLORS: Record<string, string> = {
  regular: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  bonus: "bg-green-500/10 text-green-500 border-green-500/20",
  reimbursement: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  advance: "bg-orange-500/10 text-orange-500 border-orange-500/20",
};

export function ProjectLaborExpensesList({ projectId }: ProjectLaborExpensesListProps) {
  const { data: paymentsData, isLoading } = usePersonnelPaymentsByProject(projectId);

  const payments = useMemo(() => {
    return ((paymentsData || []) as any[]).map((p, idx) => ({
      id: p.payment?.id || `payment-${idx}`,
      payment: p.payment,
      allocated_amount: p.allocated_amount,
    })) as PaymentWithAllocation[];
  }, [paymentsData]);

  const totalLaborExpenses = useMemo(() => {
    return payments.reduce((sum, p) => sum + p.allocated_amount, 0);
  }, [payments]);

  const columns: EnhancedColumn<PaymentWithAllocation>[] = [
    {
      key: "number",
      header: "Payment #",
      sortable: true,
      filterable: true,
      getValue: (item) => item.payment?.number || "",
      render: (item) => (
        <span className="font-medium text-primary">{item.payment?.number}</span>
      ),
    },
    {
      key: "personnel_name",
      header: "Personnel",
      sortable: true,
      filterable: true,
      getValue: (item) => item.payment?.personnel_name || "",
      render: (item) => (
        <Link
          to={`/personnel/${item.payment?.personnel_id}`}
          className="text-primary hover:underline flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <User className="h-4 w-4" />
          {item.payment?.personnel_name}
        </Link>
      ),
    },
    {
      key: "payment_date",
      header: "Date",
      sortable: true,
      getValue: (item) => item.payment?.payment_date || "",
      render: (item) => item.payment?.payment_date ? formatLocalDate(item.payment.payment_date, "MMM dd, yyyy") : "-",
    },
    {
      key: "payment_type",
      header: "Type",
      sortable: true,
      filterable: true,
      getValue: (item) => item.payment?.payment_type || "",
      render: (item) => (
        <Badge 
          variant="outline" 
          className={PAYMENT_TYPE_COLORS[item.payment?.payment_type || ""] || "bg-muted"}
        >
          {item.payment?.payment_type?.charAt(0).toUpperCase() + item.payment?.payment_type?.slice(1)}
        </Badge>
      ),
    },
    {
      key: "allocated_amount",
      header: "Allocated to Project",
      sortable: true,
      getValue: (item) => item.allocated_amount,
      render: (item) => (
        <span className="font-bold text-primary">{formatCurrency(item.allocated_amount)}</span>
      ),
    },
    {
      key: "gross_amount",
      header: "Total Payment",
      sortable: true,
      getValue: (item) => item.payment?.gross_amount || 0,
      render: (item) => (
        <span className="text-muted-foreground">{formatCurrency(item.payment?.gross_amount || 0)}</span>
      ),
    },
  ];

  return (
    <Card className="glass border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Labor Expenses ({payments.length})
          </CardTitle>
          {payments.length > 0 && (
            <div className="text-sm">
              <span className="text-muted-foreground">Total Labor Cost: </span>
              <span className="font-bold text-primary">{formatCurrency(totalLaborExpenses)}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading labor expenses...</div>
        ) : payments.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No labor expenses recorded for this project yet.
          </div>
        ) : (
          <EnhancedDataTable
            tableId="project-labor-expenses"
            data={payments}
            columns={columns}
          />
        )}
      </CardContent>
    </Card>
  );
}