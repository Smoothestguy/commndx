import { useState } from "react";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { RecentlyDeleted } from "@/components/dashboard/RecentlyDeleted";
import { WelcomeBanner } from "@/components/dashboard/WelcomeBanner";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useEstimates,
  Estimate,
} from "@/integrations/supabase/hooks/useEstimates";
import { useAllReimbursements } from "@/integrations/supabase/hooks/usePortal";
import {
  useInvoices,
  Invoice,
} from "@/integrations/supabase/hooks/useInvoices";
import { useProducts } from "@/integrations/supabase/hooks/useProducts";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { useAllProjectAssignments } from "@/integrations/supabase/hooks/useProjectAssignments";
import { useProfiles } from "@/integrations/supabase/hooks/useProfile";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import {
  Package,
  Users,
  FileText,
  DollarSign,
  Plus,
  FolderKanban,
  UserPlus,
  MapPin,
  Receipt,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCurrency } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { CustomizableDashboard } from "@/components/dashboard/CustomizableDashboard";

// Type for project assignments with joined profile and project data
interface ProjectAssignmentWithDetails {
  id: string;
  project_id: string;
  user_id: string;
  assigned_at: string;
  status: "active" | "removed";
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
  projects: {
    name: string;
  } | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isAdmin, isManager } = useUserRole();

  const {
    data: estimates,
    isLoading: estimatesLoading,
    refetch: refetchEstimates,
    isFetching: isFetchingEstimates,
  } = useEstimates();
  const {
    data: invoices,
    isLoading: invoicesLoading,
    refetch: refetchInvoices,
    isFetching: isFetchingInvoices,
  } = useInvoices();
  const {
    data: products,
    isLoading: productsLoading,
    refetch: refetchProducts,
    isFetching: isFetchingProducts,
  } = useProducts();
  const {
    data: customers,
    isLoading: customersLoading,
    refetch: refetchCustomers,
    isFetching: isFetchingCustomers,
  } = useCustomers();
  const {
    data: projects,
    isLoading: projectsLoading,
    refetch: refetchProjects,
    isFetching: isFetchingProjects,
  } = useProjects();
  const {
    data: assignments,
    isLoading: assignmentsLoading,
    refetch: refetchAssignments,
    isFetching: isFetchingAssignments,
  } = useAllProjectAssignments();
  const { data: profiles, isLoading: profilesLoading } = useProfiles();
  const { data: reimbursements, isLoading: reimbursementsLoading } =
    useAllReimbursements();

  const handleRefresh = async () => {
    await Promise.all([
      refetchEstimates(),
      refetchInvoices(),
      refetchProducts(),
      refetchCustomers(),
      refetchProjects(),
      refetchAssignments(),
    ]);
  };

  const isRefreshing =
    isFetchingEstimates ||
    isFetchingInvoices ||
    isFetchingProducts ||
    isFetchingCustomers ||
    isFetchingProjects ||
    isFetchingAssignments;

  // Memoize paid invoices to avoid recalculating
  const paidInvoices = useMemo(
    () => invoices?.filter((inv) => inv.status === "paid") ?? [],
    [invoices]
  );

  // Filter paid invoices by current year for revenue calculation
  const currentYear = new Date().getFullYear();
  const currentYearPaidInvoices = useMemo(
    () =>
      paidInvoices.filter((inv) => {
        const paidDate = inv.paid_date
          ? new Date(inv.paid_date)
          : new Date(inv.created_at);
        return paidDate.getFullYear() === currentYear;
      }),
    [paidInvoices, currentYear]
  );

  const stats = useMemo(() => {
    const totalRevenue = currentYearPaidInvoices.reduce(
      (sum, inv) => sum + (inv.total ?? 0),
      0
    );

    const pendingEstimates =
      estimates?.filter(
        (est) => est.status === "pending" || est.status === "sent"
      ).length ?? 0;

    return {
      totalRevenue,
      activeProducts: products?.length ?? 0,
      totalCustomers: customers?.length ?? 0,
      pendingEstimates,
    };
  }, [estimates, currentYearPaidInvoices, products, customers]);

  const recentEstimates = useMemo(() => {
    if (!estimates) return [];
    return [...estimates]
      .sort((a, b) => {
        const numA = parseInt(String(a.number).replace(/\D/g, "")) || 0;
        const numB = parseInt(String(b.number).replace(/\D/g, "")) || 0;
        return numB - numA;
      })
      .slice(0, 5);
  }, [estimates]);

  const recentInvoices = useMemo(() => invoices?.slice(0, 5) ?? [], [invoices]);

  // Memoize recent assignments (active only, sorted by assigned_at desc)
  const recentAssignments = useMemo(
    () =>
      (assignments as ProjectAssignmentWithDetails[] | undefined)
        ?.filter((a) => a.status === "active")
        .sort((a, b) => {
          const dateA = a.assigned_at ? new Date(a.assigned_at).getTime() : 0;
          const dateB = b.assigned_at ? new Date(b.assigned_at).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 5) ?? [],
    [assignments]
  );

  // Memoize active projects count
  const activeProjectsCount = useMemo(
    () => projects?.filter((p) => p.status === "active").length ?? 0,
    [projects]
  );

  // Staffing stats computation
  const staffingStats = useMemo(() => {
    const activeAssignments =
      (assignments as ProjectAssignmentWithDetails[] | undefined)?.filter(
        (a) => a.status === "active"
      ) ?? [];
    const assignedUserIds = new Set(activeAssignments.map((a) => a.user_id));
    const assignedStaff = assignedUserIds.size;
    const totalStaff = profiles?.length ?? 0;
    const availableStaff = Math.max(0, totalStaff - assignedStaff);

    return { assignedStaff, totalStaff, availableStaff };
  }, [assignments, profiles]);

  // Pending reimbursements stats
  const pendingReimbursements = useMemo(() => {
    const pending = reimbursements?.filter((r) => r.status === "pending") ?? [];
    const total = pending.reduce((sum, r) => sum + r.amount, 0);
    return { count: pending.length, total };
  }, [reimbursements]);

  // Project analytics data
  const projectsByStatus = useMemo(() => {
    if (!projects) return [];
    const statusCount = projects.reduce((acc, project) => {
      acc[project.status] = (acc[project.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(statusCount).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
    }));
  }, [projects]);

  // O(n) customer lookup using Map instead of O(n²) find()
  const projectsByCustomer = useMemo(() => {
    if (!projects || !customers) return [];

    // Build customer lookup Map O(n)
    const customerMap = new Map<string, string>(
      customers.map((c) => [c.id, c.name])
    );

    // Single pass O(n)
    const customerCount = projects.reduce((acc, project) => {
      const customerName = customerMap.get(project.customer_id);
      if (customerName) {
        acc[customerName] = (acc[customerName] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(customerCount)
      .map(([name, count]) => ({ name, projects: count }))
      .sort((a, b) => b.projects - a.projects)
      .slice(0, 5);
  }, [projects, customers]);

  const COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--secondary))",
    "hsl(var(--accent))",
  ];

  const isLoading =
    estimatesLoading ||
    invoicesLoading ||
    productsLoading ||
    customersLoading ||
    projectsLoading ||
    assignmentsLoading ||
    profilesLoading ||
    reimbursementsLoading;

  // Properly typed column definitions with snake_case keys matching Supabase data
  const estimateColumns: Column<Estimate>[] = useMemo(
    () => [
      { key: "number", header: "Estimate #" },
      { key: "customer_name", header: "Customer" },
      {
        key: "project_name",
        header: "Project",
        className: "hidden sm:table-cell",
      },
      {
        key: "status",
        header: "Status",
        render: (item: Estimate) => <StatusBadge status={item.status} />,
      },
      {
        key: "total",
        header: "Total",
        render: (item: Estimate) => (
          <span className="font-medium">{formatCurrency(item.total)}</span>
        ),
      },
    ],
    []
  );

  const invoiceColumns: Column<Invoice>[] = useMemo(
    () => [
      { key: "number", header: "Invoice #" },
      { key: "customer_name", header: "Customer" },
      {
        key: "status",
        header: "Status",
        render: (item: Invoice) => <StatusBadge status={item.status} />,
      },
      {
        key: "total",
        header: "Amount",
        render: (item: Invoice) => (
          <span className="font-medium">{formatCurrency(item.total)}</span>
        ),
      },
      {
        key: "due_date",
        header: "Due Date",
        className: "hidden sm:table-cell",
        render: (item: Invoice) => (
          <span>
            {item.due_date ? new Date(item.due_date).toLocaleDateString() : "—"}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <>
      <SEO
        title="Dashboard"
        description="Overview of your business metrics, estimates, invoices, and recent activity"
        keywords="business dashboard, metrics, estimates overview, invoice tracking"
      />
      <PageLayout
        title="Dashboard"
        description="Welcome back to Command X"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/staffing/map")}
              className="h-9 px-3"
            >
              <MapPin className="h-4 w-4" />
              <span className="ml-1.5 hidden sm:inline">Map View</span>
            </Button>
            <Button
              variant="glow"
              size="sm"
              onClick={() => navigate("/estimates/new")}
              className="h-9 px-3"
            >
              <Plus className="h-4 w-4" />
              <span className="ml-1.5">New Estimate</span>
            </Button>
          </div>
        }
      >
        <CustomizableDashboard>
          {/* Fallback content for users who cannot customize */}
          <PullToRefreshWrapper
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          >
            {/* Welcome Banner */}
            <WelcomeBanner />

            {/* Stats Grid - Mobile optimized with compact cards */}
            <div className="grid gap-2 sm:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 mb-4 sm:mb-8">
              <StatCard
                title={`${currentYear} Revenue`}
                value={isLoading ? "..." : formatCurrency(stats.totalRevenue)}
                change={
                  currentYearPaidInvoices.length
                    ? `${currentYearPaidInvoices.length} paid invoices`
                    : "No paid invoices"
                }
                changeType="positive"
                icon={DollarSign}
                href="/invoices"
                compact={isMobile}
              />
              <StatCard
                title="Active Projects"
                value={isLoading ? "..." : activeProjectsCount}
                change={`${projects?.length ?? 0} total`}
                changeType="positive"
                icon={FolderKanban}
                href="/projects"
                compact={isMobile}
              />
              <StatCard
                title="Staffing"
                value={
                  isLoading
                    ? "..."
                    : `${staffingStats.assignedStaff}/${staffingStats.totalStaff}`
                }
                change={`${staffingStats.availableStaff} available`}
                changeType={
                  staffingStats.availableStaff > 0 ? "positive" : "neutral"
                }
                icon={Users}
                href="/project-assignments"
                compact={isMobile}
              />
              <StatCard
                title="Active Products"
                value={isLoading ? "..." : stats.activeProducts}
                change={`${stats.activeProducts} in catalog`}
                changeType="neutral"
                icon={Package}
                href="/products"
                compact={isMobile}
              />
              <StatCard
                title="Customers"
                value={isLoading ? "..." : stats.totalCustomers}
                change={`${stats.totalCustomers} total`}
                changeType="positive"
                icon={Users}
                href="/customers"
                compact={isMobile}
              />
              <StatCard
                title="Pending Estimates"
                value={isLoading ? "..." : stats.pendingEstimates}
                change={
                  stats.pendingEstimates > 0
                    ? `${stats.pendingEstimates} require attention`
                    : "All caught up"
                }
                changeType={stats.pendingEstimates > 0 ? "neutral" : "positive"}
                icon={FileText}
                href="/estimates"
                compact={isMobile}
              />
              <StatCard
                title="Pending Reimbursements"
                value={isLoading ? "..." : pendingReimbursements.count}
                change={
                  pendingReimbursements.count > 0
                    ? formatCurrency(pendingReimbursements.total)
                    : "No pending"
                }
                changeType={
                  pendingReimbursements.count > 0 ? "neutral" : "positive"
                }
                icon={Receipt}
                href="/reimbursements"
                compact={isMobile}
              />
            </div>

            {/* Project Analytics Charts - Mobile optimized */}
            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2 mb-6 sm:mb-8">
              <Card className="glass border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="font-heading text-base sm:text-lg">
                    Projects by Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading || projectsByStatus.length === 0 ? (
                    <div className="h-[220px] sm:h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                      {isLoading ? "Loading..." : "No projects yet"}
                    </div>
                  ) : (
                    <ResponsiveContainer
                      width="100%"
                      height={isMobile ? 220 : 300}
                    >
                      <PieChart>
                        <Pie
                          data={projectsByStatus}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={
                            isMobile
                              ? ({ value }) => `${value}`
                              : ({ name, value }) => `${name}: ${value}`
                          }
                          outerRadius={isMobile ? 70 : 100}
                          fill="hsl(var(--primary))"
                          dataKey="value"
                        >
                          {projectsByStatus.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="glass border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="font-heading text-base sm:text-lg">
                    Projects by Customer (Top 5)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading || projectsByCustomer.length === 0 ? (
                    <div className="h-[220px] sm:h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                      {isLoading ? "Loading..." : "No projects yet"}
                    </div>
                  ) : (
                    <ResponsiveContainer
                      width="100%"
                      height={isMobile ? 220 : 300}
                    >
                      <BarChart data={projectsByCustomer}>
                        <XAxis
                          dataKey="name"
                          tick={{
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: isMobile ? 10 : 12,
                          }}
                          angle={isMobile ? 0 : -45}
                          textAnchor={isMobile ? "middle" : "end"}
                          height={isMobile ? 60 : 80}
                          interval={0}
                          hide={isMobile}
                        />
                        <YAxis
                          tick={{
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: isMobile ? 10 : 12,
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <Legend
                          wrapperStyle={{
                            fontSize: isMobile ? "12px" : "14px",
                          }}
                        />
                        <Bar
                          dataKey="projects"
                          fill="hsl(var(--primary))"
                          radius={[8, 8, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Main Content Grid - Mobile optimized */}
            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
              {/* Recent Estimates */}
              <div className="lg:col-span-2 space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-base sm:text-lg font-semibold text-foreground">
                    Recent Estimates
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/estimates")}
                    className="text-xs sm:text-sm min-h-[44px]"
                  >
                    View all
                  </Button>
                </div>
                {isLoading ? (
                  <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                    Loading estimates...
                  </div>
                ) : recentEstimates.length === 0 ? (
                  <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                    No estimates yet. Create your first estimate to get started!
                  </div>
                ) : isMobile ? (
                  <div className="space-y-3">
                    {recentEstimates.map((estimate) => (
                      <Card
                        key={estimate.id}
                        className="glass p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                        onClick={() => navigate(`/estimates/${estimate.id}`)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-medium text-foreground">
                              {estimate.number}
                            </span>
                            <p className="text-sm text-muted-foreground">
                              {estimate.customer_name}
                            </p>
                          </div>
                          <StatusBadge status={estimate.status} />
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">
                            {estimate.project_name || "No project"}
                          </span>
                          <span className="text-primary font-semibold">
                            {formatCurrency(estimate.total)}
                          </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <DataTable
                    data={recentEstimates}
                    columns={estimateColumns}
                    onRowClick={(item) => navigate(`/estimates/${item.id}`)}
                  />
                )}
              </div>

              {/* Recent Activity & Recently Deleted */}
              <div className="lg:col-span-1 order-last lg:order-none space-y-4 sm:space-y-6">
                <RecentActivity />
                <RecentlyDeleted />
              </div>
            </div>

            {/* Recent Invoices */}
            <div className="mt-6 sm:mt-8 space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-base sm:text-lg font-semibold text-foreground">
                  Recent Invoices
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/invoices")}
                  className="text-xs sm:text-sm min-h-[44px]"
                >
                  View all
                </Button>
              </div>
              {isLoading ? (
                <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                  Loading invoices...
                </div>
              ) : recentInvoices.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                  No invoices yet.
                </div>
              ) : isMobile ? (
                <div className="space-y-3">
                  {recentInvoices.map((invoice) => (
                    <Card
                      key={invoice.id}
                      className="glass p-3 sm:p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                      onClick={() => navigate(`/invoices/${invoice.id}`)}
                    >
                      <div className="flex justify-between items-start gap-2 mb-2 min-w-0">
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-foreground text-sm sm:text-base">
                            {invoice.number}
                          </span>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
                            {invoice.customer_name}
                          </p>
                        </div>
                        <StatusBadge status={invoice.status} />
                      </div>
                      <div className="flex justify-between items-center text-xs sm:text-sm gap-2">
                        <span className="text-muted-foreground">
                          Due:{" "}
                          {invoice.due_date
                            ? new Date(invoice.due_date).toLocaleDateString()
                            : "—"}
                        </span>
                        <span className="text-primary font-semibold flex-shrink-0">
                          {formatCurrency(invoice.total)}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <DataTable
                  data={recentInvoices}
                  columns={invoiceColumns}
                  onRowClick={(item) => navigate(`/invoices/${item.id}`)}
                />
              )}
            </div>

            {/* Recent Assignments */}
            <div className="mt-6 sm:mt-8 space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-base sm:text-lg font-semibold text-foreground">
                  Recent Assignments
                </h3>
                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/project-assignments")}
                    className="text-xs min-h-[44px] px-2 sm:px-3"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span className="hidden sm:inline ml-1">Assign Staff</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/project-assignments")}
                    className="text-xs min-h-[44px] px-2 sm:px-3"
                  >
                    View all
                  </Button>
                </div>
              </div>
              {isLoading ? (
                <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                  Loading assignments...
                </div>
              ) : recentAssignments.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                  No assignments yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentAssignments.map((assignment) => (
                    <Card
                      key={assignment.id}
                      className="glass p-3 sm:p-4 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex justify-between items-start gap-2 min-w-0">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <UserPlus className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground text-sm sm:text-base truncate">
                              {assignment.profiles?.first_name}{" "}
                              {assignment.profiles?.last_name}
                            </p>
                            <p className="text-xs sm:text-sm text-muted-foreground truncate">
                              {assignment.profiles?.email}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 max-w-[35%] sm:max-w-[40%]">
                          <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                            {assignment.projects?.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {assignment.assigned_at
                              ? new Date(
                                  assignment.assigned_at
                                ).toLocaleDateString()
                              : "—"}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </PullToRefreshWrapper>
        </CustomizableDashboard>
      </PageLayout>
    </>
  );
};

export default Dashboard;
