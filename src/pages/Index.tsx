import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEstimates, Estimate } from "@/integrations/supabase/hooks/useEstimates";
import { useInvoices, Invoice } from "@/integrations/supabase/hooks/useInvoices";
import { useProducts } from "@/integrations/supabase/hooks/useProducts";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import {
  Package,
  Users,
  FileText,
  DollarSign,
  Plus,
  FolderKanban,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCurrency } from "@/lib/utils";

const Dashboard = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const { data: estimates, isLoading: estimatesLoading, refetch: refetchEstimates, isFetching: isFetchingEstimates } = useEstimates();
  const { data: invoices, isLoading: invoicesLoading, refetch: refetchInvoices, isFetching: isFetchingInvoices } = useInvoices();
  const { data: products, isLoading: productsLoading, refetch: refetchProducts, isFetching: isFetchingProducts } = useProducts();
  const { data: customers, isLoading: customersLoading, refetch: refetchCustomers, isFetching: isFetchingCustomers } = useCustomers();
  const { data: projects, isLoading: projectsLoading, refetch: refetchProjects, isFetching: isFetchingProjects } = useProjects();

  const handleRefresh = async () => {
    await Promise.all([
      refetchEstimates(),
      refetchInvoices(),
      refetchProducts(),
      refetchCustomers(),
      refetchProjects(),
    ]);
  };

  const isRefreshing = isFetchingEstimates || isFetchingInvoices || isFetchingProducts || isFetchingCustomers || isFetchingProjects;

  // Memoize paid invoices to avoid recalculating
  const paidInvoices = useMemo(() => 
    invoices?.filter((inv) => inv.status === "paid") ?? [], 
    [invoices]
  );

  const stats = useMemo(() => {
    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + (inv.total ?? 0), 0);
    
    const pendingEstimates = estimates?.filter(
      (est) => est.status === "pending" || est.status === "sent"
    ).length ?? 0;

    return {
      totalRevenue,
      activeProducts: products?.length ?? 0,
      totalCustomers: customers?.length ?? 0,
      pendingEstimates,
    };
  }, [estimates, paidInvoices, products, customers]);

  const recentEstimates = useMemo(() => 
    estimates?.slice(0, 5) ?? [], 
    [estimates]
  );

  const recentInvoices = useMemo(() => 
    invoices?.slice(0, 5) ?? [], 
    [invoices]
  );

  // Memoize active projects count
  const activeProjectsCount = useMemo(() => 
    projects?.filter(p => p.status === "active").length ?? 0,
    [projects]
  );

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

  const projectsByCustomer = useMemo(() => {
    if (!projects || !customers) return [];
    const customerCount = projects.reduce((acc, project) => {
      const customer = customers.find((c) => c.id === project.customer_id);
      if (customer) {
        acc[customer.name] = (acc[customer.name] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(customerCount)
      .map(([name, count]) => ({ name, projects: count }))
      .sort((a, b) => b.projects - a.projects)
      .slice(0, 5);
  }, [projects, customers]);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))'];

  const isLoading = estimatesLoading || invoicesLoading || productsLoading || customersLoading || projectsLoading;

  // Properly typed column definitions with snake_case keys matching Supabase data
  const estimateColumns: Column<Estimate>[] = useMemo(() => [
    { key: "number", header: "Estimate #" },
    { key: "customer_name", header: "Customer" },
    { key: "project_name", header: "Project", className: "hidden sm:table-cell" },
    {
      key: "status",
      header: "Status",
      render: (item: Estimate) => (
        <StatusBadge status={item.status} />
      ),
    },
    {
      key: "total",
      header: "Total",
      render: (item: Estimate) => (
        <span className="font-medium">{formatCurrency(item.total)}</span>
      ),
    },
  ], []);

  const invoiceColumns: Column<Invoice>[] = useMemo(() => [
    { key: "number", header: "Invoice #" },
    { key: "customer_name", header: "Customer" },
    {
      key: "status",
      header: "Status",
      render: (item: Invoice) => (
        <StatusBadge status={item.status} />
      ),
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
        <span>{item.due_date ? new Date(item.due_date).toLocaleDateString() : "—"}</span>
      ),
    },
  ], []);

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
        <Button 
          variant="glow" 
          size={isMobile ? "sm" : "default"}
          onClick={() => navigate("/estimates/new")}
        >
          <Plus className="h-4 w-4" />
          {!isMobile && <span className="ml-2">New Estimate</span>}
        </Button>
      }
    >
      <PullToRefreshWrapper onRefresh={handleRefresh} isRefreshing={isRefreshing}>
        {/* Stats Grid - Mobile optimized */}
      <div className="grid gap-3 sm:gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 mb-4 sm:mb-8">
        <StatCard
          title="Total Revenue"
          value={isLoading ? "..." : formatCurrency(stats.totalRevenue)}
          change={paidInvoices.length ? `${paidInvoices.length} paid invoices` : "No paid invoices"}
          changeType="positive"
          icon={DollarSign}
        />
        <StatCard
          title="Active Projects"
          value={isLoading ? "..." : projects?.length ?? 0}
          change={`${activeProjectsCount} active`}
          changeType="positive"
          icon={FolderKanban}
        />
        <StatCard
          title="Active Products"
          value={isLoading ? "..." : stats.activeProducts}
          change={`${stats.activeProducts} in catalog`}
          changeType="neutral"
          icon={Package}
        />
        <StatCard
          title="Customers"
          value={isLoading ? "..." : stats.totalCustomers}
          change={`${stats.totalCustomers} total`}
          changeType="positive"
          icon={Users}
        />
        <StatCard
          title="Pending Estimates"
          value={isLoading ? "..." : stats.pendingEstimates}
          change={stats.pendingEstimates > 0 ? `${stats.pendingEstimates} require attention` : "All caught up"}
          changeType={stats.pendingEstimates > 0 ? "neutral" : "positive"}
          icon={FileText}
        />
      </div>

      {/* Project Analytics Charts - Mobile optimized */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2 mb-6 sm:mb-8">
        <Card className="glass border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base sm:text-lg">Projects by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || projectsByStatus.length === 0 ? (
              <div className="h-[220px] sm:h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                {isLoading ? "Loading..." : "No projects yet"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
                <PieChart>
                  <Pie
                    data={projectsByStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={isMobile ? ({ value }) => `${value}` : ({ name, value }) => `${name}: ${value}`}
                    outerRadius={isMobile ? 70 : 100}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {projectsByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
            <CardTitle className="font-heading text-base sm:text-lg">Projects by Customer (Top 5)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || projectsByCustomer.length === 0 ? (
              <div className="h-[220px] sm:h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                {isLoading ? "Loading..." : "No projects yet"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
                <BarChart data={projectsByCustomer}>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: isMobile ? 10 : 12 }}
                    angle={isMobile ? 0 : -45}
                    textAnchor={isMobile ? "middle" : "end"}
                    height={isMobile ? 60 : 80}
                    interval={0}
                    hide={isMobile}
                  />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: isMobile ? 10 : 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: isMobile ? "12px" : "14px" }} />
                  <Bar dataKey="projects" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
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
            <Button variant="ghost" size="sm" onClick={() => navigate("/estimates")} className="text-xs sm:text-sm min-h-[44px]">
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
                      <span className="font-medium text-foreground">{estimate.number}</span>
                      <p className="text-sm text-muted-foreground">{estimate.customer_name}</p>
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

        {/* Recent Activity */}
        <div className="lg:col-span-1 order-last lg:order-none">
          <RecentActivity />
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="mt-6 sm:mt-8 space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base sm:text-lg font-semibold text-foreground">
            Recent Invoices
          </h3>
          <Button variant="ghost" size="sm" onClick={() => navigate("/invoices")} className="text-xs sm:text-sm min-h-[44px]">
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
                className="glass p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                onClick={() => navigate(`/invoices/${invoice.id}`)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-medium text-foreground">{invoice.number}</span>
                    <p className="text-sm text-muted-foreground">{invoice.customer_name}</p>
                  </div>
                  <StatusBadge status={invoice.status} />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">
                    Due: {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "—"}
                  </span>
                  <span className="text-primary font-semibold">
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
      </PullToRefreshWrapper>
    </PageLayout>
    </>
  );
};

export default Dashboard;
