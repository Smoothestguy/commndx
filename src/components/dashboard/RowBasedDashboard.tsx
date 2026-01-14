import { useMemo } from "react";
import { useEstimates } from "@/integrations/supabase/hooks/useEstimates";
import { useInvoices } from "@/integrations/supabase/hooks/useInvoices";
import { useProducts } from "@/integrations/supabase/hooks/useProducts";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { useAllProjectAssignments } from "@/integrations/supabase/hooks/useProjectAssignments";
import { useProfiles } from "@/integrations/supabase/hooks/useProfile";
import { formatCurrency } from "@/lib/utils";
import {
  DollarSign,
  FolderKanban,
  Users,
  FileText,
  Package,
} from "lucide-react";

import { WelcomeStrip } from "./rows/WelcomeStrip";
import { KPIBar } from "./rows/KPIBar";
import { QuickActionsRow } from "./rows/QuickActionsRow";
import { RevenueChartRow } from "./rows/RevenueChartRow";
import { RecentInvoicesTable } from "./rows/RecentInvoicesTable";
import { RecentActivityTable } from "./rows/RecentActivityTable";

interface ProjectAssignmentWithDetails {
  id: string;
  project_id: string;
  user_id: string;
  assigned_at: string;
  status: "active" | "removed";
  profiles: { first_name: string | null; last_name: string | null; email: string | null } | null;
  projects: { name: string } | null;
}

export function RowBasedDashboard() {
  const { data: estimates, isLoading: estimatesLoading } = useEstimates();
  const { data: invoices, isLoading: invoicesLoading } = useInvoices();
  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: customers, isLoading: customersLoading } = useCustomers();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: assignments, isLoading: assignmentsLoading } = useAllProjectAssignments();
  const { data: profiles, isLoading: profilesLoading } = useProfiles();

  const isLoading =
    estimatesLoading ||
    invoicesLoading ||
    productsLoading ||
    customersLoading ||
    projectsLoading ||
    assignmentsLoading ||
    profilesLoading;

  const currentYear = new Date().getFullYear();

  const stats = useMemo(() => {
    const paidInvoices = invoices?.filter((inv) => inv.status === "paid") ?? [];
    const currentYearPaid = paidInvoices.filter((inv) => {
      const paidDate = inv.paid_date ? new Date(inv.paid_date) : new Date(inv.created_at);
      return paidDate.getFullYear() === currentYear;
    });
    const totalRevenue = currentYearPaid.reduce((sum, inv) => sum + (inv.total ?? 0), 0);

    const activeProjectsCount = projects?.filter((p) => p.status === "active").length ?? 0;

    const activeAssignments = (assignments as ProjectAssignmentWithDetails[] | undefined)?.filter(
      (a) => a.status === "active"
    ) ?? [];
    const assignedUserIds = new Set(activeAssignments.map((a) => a.user_id));
    const assignedStaff = assignedUserIds.size;
    const totalStaff = profiles?.length ?? 0;

    const pendingEstimates =
      estimates?.filter((est) => est.status === "pending" || est.status === "sent").length ?? 0;

    return {
      revenue: totalRevenue,
      activeProjects: activeProjectsCount,
      totalProjects: projects?.length ?? 0,
      staffing: `${assignedStaff}/${totalStaff}`,
      pendingEstimates,
      totalCustomers: customers?.length ?? 0,
    };
  }, [invoices, projects, assignments, profiles, estimates, customers, currentYear]);

  const kpiItems = [
    {
      label: `${currentYear} Revenue`,
      value: formatCurrency(stats.revenue),
      icon: DollarSign,
      href: "/invoices",
    },
    {
      label: "Active Projects",
      value: stats.activeProjects,
      subtext: `${stats.totalProjects} total`,
      icon: FolderKanban,
      href: "/projects",
    },
    {
      label: "Staffing",
      value: stats.staffing,
      subtext: "assigned/total",
      icon: Users,
      href: "/personnel",
    },
    {
      label: "Pending Estimates",
      value: stats.pendingEstimates,
      icon: FileText,
      href: "/estimates",
    },
    {
      label: "Customers",
      value: stats.totalCustomers,
      icon: Package,
      href: "/customers",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Row 2: Welcome Strip */}
      <WelcomeStrip />

      {/* Row 3: KPI Bar */}
      <KPIBar items={kpiItems} isLoading={isLoading} />

      {/* Row 4: Quick Actions */}
      <QuickActionsRow />

      {/* Row 5: Revenue Chart */}
      <RevenueChartRow />

      {/* Row 6: Two Tables Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentInvoicesTable />
        <RecentActivityTable />
      </div>
    </div>
  );
}
