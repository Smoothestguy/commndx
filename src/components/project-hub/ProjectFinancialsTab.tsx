import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FileText, Briefcase, Receipt, Plus } from "lucide-react";
import { ProjectFinancialSummary } from "./ProjectFinancialSummary";
import { ProjectLaborAllocation } from "./ProjectLaborAllocation";
import { ProjectRateBracketsSection } from "./ProjectRateBracketsSection";
import { ProjectVendorBillsList } from "./ProjectVendorBillsList";
import { ProjectChangeOrdersList } from "./ProjectChangeOrdersList";
import { ProjectTMTicketsList } from "./ProjectTMTicketsList";
import { ProjectPurchaseOrdersList } from "./ProjectPurchaseOrdersList";
import { useEstimatesByProject } from "@/integrations/supabase/hooks/useEstimates";
import { useJobOrdersByProject } from "@/integrations/supabase/hooks/useJobOrders";
import { useInvoicesByProject } from "@/integrations/supabase/hooks/useInvoices";
import { usePurchaseOrdersByProject } from "@/integrations/supabase/hooks/usePurchaseOrders";
import { useChangeOrdersByProject } from "@/integrations/supabase/hooks/useChangeOrders";
import { useTMTicketsByProject } from "@/integrations/supabase/hooks/useTMTickets";
import { useVendorBills } from "@/integrations/supabase/hooks/useVendorBills";
import { useExpensesByProject } from "@/integrations/supabase/hooks/useExpenseReports";
import { useProjectTimeEntryCosts } from "@/integrations/supabase/hooks/useProjectLaborExpenses";
import { AddTMTicketDialog } from "@/components/tm-tickets/AddTMTicketDialog";
import { CreateJobOrderDialog } from "@/components/job-orders/CreateJobOrderDialog";
import { CreateProjectInvoiceDialog } from "@/components/invoices/CreateProjectInvoiceDialog";

interface Props {
  projectId: string;
  project: any;
  customer: any;
}

export function ProjectFinancialsTab({ projectId, project, customer }: Props) {
  const navigate = useNavigate();
  const { data: estimates = [] } = useEstimatesByProject(projectId);
  const { data: jobOrders = [] } = useJobOrdersByProject(projectId);
  const { data: invoices = [] } = useInvoicesByProject(projectId);
  const { data: purchaseOrders = [] } = usePurchaseOrdersByProject(projectId);
  const { data: changeOrders = [] } = useChangeOrdersByProject(projectId);
  const { data: tmTickets = [] } = useTMTicketsByProject(projectId);
  const { data: vendorBills } = useVendorBills({ project_id: projectId });
  const { data: projectExpenses } = useExpensesByProject(projectId);
  const { data: timeEntryCosts } = useProjectTimeEntryCosts(projectId);

  const [isTMTicketDialogOpen, setIsTMTicketDialogOpen] = useState(false);
  const [isJobOrderDialogOpen, setIsJobOrderDialogOpen] = useState(false);
  const [isCreateInvoiceDialogOpen, setIsCreateInvoiceDialogOpen] = useState(false);

  const { data: supervisionBreakdown } = useQuery({
    queryKey: ["project-supervision-costs", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select(
          `hours, hourly_rate, is_overhead, personnel:personnel_id (hourly_rate, title)`
        )
        .eq("project_id", projectId)
        .not("personnel_id", "is", null);
      if (error) throw error;
      let supervisionCost = 0;
      let fieldCost = 0;
      for (const entry of data || []) {
        if ((entry as any).is_overhead) continue;
        const p = (entry as any).personnel;
        const rate = (entry as any).hourly_rate ?? p?.hourly_rate ?? 0;
        const cost = ((entry as any).hours || 0) * rate;
        const title = (p?.title || "").toLowerCase();
        const isSupervision =
          title.includes("superintendent") ||
          title.includes("supervisor") ||
          title.includes("foreman");
        if (isSupervision) supervisionCost += cost;
        else fieldCost += cost;
      }
      return { supervisionCost, fieldCost };
    },
  });

  const financialData = useMemo(() => {
    const originalContractValue = jobOrders.reduce((s, j: any) => s + j.total, 0);
    const changeOrdersTotal = (changeOrders || [])
      .filter((co: any) => co.status === "approved")
      .reduce((s: number, co: any) => {
        const t = (co as any).change_type || "additive";
        return t === "deductive" ? s - co.total : s + co.total;
      }, 0);
    const tmTicketsTotal = (tmTickets || [])
      .filter((t: any) => ["approved", "signed", "invoiced"].includes(t.status))
      .reduce((s: number, t: any) => {
        const ct = (t as any).change_type || "additive";
        return ct === "deductive" ? s - t.total : s + t.total;
      }, 0);
    const totalContractValue = originalContractValue + changeOrdersTotal + tmTicketsTotal;
    const totalPOValue = purchaseOrders.reduce(
      (s: number, po: any) => s + po.total + (po.total_addendum_amount || 0),
      0
    );
    const totalVendorBilled = (vendorBills || []).reduce((s, b: any) => s + b.total, 0);
    const totalVendorPaid = (vendorBills || []).reduce(
      (s, b: any) => s + (b.paid_amount || 0),
      0
    );
    const totalInvoiced = invoices.reduce((s, i: any) => s + i.total, 0);
    const totalPaid = invoices.reduce((s, i: any) => s + (i.paid_amount || 0), 0);
    const grossProfit = totalContractValue - totalPOValue;
    const grossMargin = totalContractValue > 0 ? (grossProfit / totalContractValue) * 100 : 0;
    const timeEntryLaborCost = timeEntryCosts?.totalLaborCost || 0;
    const personnelPaymentCost = projectExpenses?.personnel_total || 0;
    const totalLaborCost = timeEntryLaborCost + personnelPaymentCost;
    const totalOtherExpenses = 0;
    const totalAllCosts = totalPOValue + totalLaborCost;
    const netProfit = totalContractValue - totalAllCosts;
    const netMargin = totalContractValue > 0 ? (netProfit / totalContractValue) * 100 : 0;

    return {
      originalContractValue,
      changeOrdersTotal,
      tmTicketsTotal,
      totalContractValue,
      totalPOValue,
      totalVendorBilled,
      totalVendorPaid,
      totalInvoiced,
      totalPaid,
      grossProfit,
      grossMargin,
      totalLaborCost,
      totalOtherExpenses,
      netProfit,
      netMargin,
      supervisionLaborCost: supervisionBreakdown?.supervisionCost || 0,
      fieldLaborCost: supervisionBreakdown?.fieldCost || 0,
    };
  }, [jobOrders, changeOrders, tmTickets, purchaseOrders, invoices, vendorBills, projectExpenses, timeEntryCosts, supervisionBreakdown]);

  const estimateColumns = [
    { key: "number", header: "Estimate #" },
    { key: "customer_name", header: "Customer" },
    { key: "status", header: "Status", render: (i: any) => <StatusBadge status={i.status} /> },
    {
      key: "total",
      header: "Total",
      render: (i: any) => <span className="font-medium">${i.total.toFixed(2)}</span>,
    },
    {
      key: "created_at",
      header: "Created",
      render: (i: any) => format(new Date(i.created_at), "MMM dd, yyyy"),
    },
  ];

  const jobOrderColumns = [
    { key: "number", header: "Job Order #" },
    { key: "status", header: "Status", render: (i: any) => <StatusBadge status={i.status} /> },
    {
      key: "total",
      header: "Total",
      render: (i: any) => <span className="font-medium">${i.total.toFixed(2)}</span>,
    },
    {
      key: "start_date",
      header: "Start Date",
      render: (i: any) => format(new Date(i.start_date), "MMM dd, yyyy"),
    },
  ];

  const invoiceColumns = [
    { key: "number", header: "Invoice #" },
    { key: "status", header: "Status", render: (i: any) => <StatusBadge status={i.status} /> },
    {
      key: "total",
      header: "Amount",
      render: (i: any) => <span className="font-medium">${i.total.toFixed(2)}</span>,
    },
    {
      key: "due_date",
      header: "Due Date",
      render: (i: any) => format(new Date(i.due_date), "MMM dd, yyyy"),
    },
  ];

  return (
    <div className="space-y-8">
      <ProjectFinancialSummary data={financialData} />
      <ProjectLaborAllocation projectId={projectId} />
      <ProjectRateBracketsSection projectId={projectId} />

      {/* Estimates */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="font-heading text-lg font-semibold">
            Estimates ({estimates.length})
          </h3>
        </div>
        {estimates.length === 0 ? (
          <Card className="glass border-border">
            <CardContent className="py-8 text-center text-muted-foreground">
              No estimates for this project yet.
            </CardContent>
          </Card>
        ) : (
          <DataTable
            data={estimates}
            columns={estimateColumns}
            onRowClick={(item) => navigate(`/estimates/${item.id}`)}
          />
        )}
      </div>

      {/* Job Orders */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-lg font-semibold">
              Job Orders ({jobOrders.length})
            </h3>
          </div>
          <Button size="sm" onClick={() => setIsJobOrderDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Create JO
          </Button>
        </div>
        {jobOrders.length === 0 ? (
          <Card className="glass border-border">
            <CardContent className="py-8 text-center text-muted-foreground">
              No job orders for this project yet.
            </CardContent>
          </Card>
        ) : (
          <DataTable
            data={jobOrders}
            columns={jobOrderColumns}
            onRowClick={(item) => navigate(`/job-orders/${item.id}`)}
          />
        )}
      </div>

      {/* Invoices */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-lg font-semibold">
              Invoices ({invoices.length})
            </h3>
          </div>
          <Button size="sm" onClick={() => setIsCreateInvoiceDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Create Invoice
          </Button>
        </div>
        {invoices.length === 0 ? (
          <Card className="glass border-border">
            <CardContent className="py-8 text-center text-muted-foreground">
              No invoices for this project yet.
            </CardContent>
          </Card>
        ) : (
          <DataTable
            data={invoices}
            columns={invoiceColumns}
            onRowClick={(item) => navigate(`/invoices/${item.id}`)}
          />
        )}
      </div>

      <ProjectVendorBillsList
        projectId={projectId}
        onAddNew={() => navigate(`/vendor-bills/new?projectId=${projectId}`)}
      />
      <ProjectChangeOrdersList
        changeOrders={changeOrders || []}
        projectId={projectId}
        onAddNew={() => navigate(`/change-orders/new?projectId=${projectId}`)}
      />
      <ProjectTMTicketsList
        tickets={tmTickets || []}
        projectId={projectId}
        onAddNew={() => setIsTMTicketDialogOpen(true)}
      />
      <ProjectPurchaseOrdersList
        purchaseOrders={purchaseOrders}
        projectId={projectId}
        onAddNew={() => navigate(`/purchase-orders/new?projectId=${projectId}`)}
      />

      <AddTMTicketDialog
        open={isTMTicketDialogOpen}
        onOpenChange={setIsTMTicketDialogOpen}
        projectId={projectId}
      />
      {project && customer && (
        <CreateJobOrderDialog
          isOpen={isJobOrderDialogOpen}
          onClose={() => setIsJobOrderDialogOpen(false)}
          projectId={project.id}
          projectName={project.name}
          customerId={customer.id}
          customerName={customer.name}
        />
      )}
      {project && customer && (
        <CreateProjectInvoiceDialog
          open={isCreateInvoiceDialogOpen}
          onOpenChange={setIsCreateInvoiceDialogOpen}
          projectId={project.id}
          projectName={project.name}
          customerId={customer.id}
          customerName={customer.name}
        />
      )}
    </div>
  );
}
