import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Eye, Briefcase, Loader2 } from "lucide-react";
import { useJobOrders, JobOrder } from "@/integrations/supabase/hooks/useJobOrders";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import { useIsMobile } from "@/hooks/use-mobile";
import { JobOrderCard } from "@/components/job-orders/JobOrderCard";
import { JobOrderStats } from "@/components/job-orders/JobOrderStats";
import { JobOrderFilters } from "@/components/job-orders/JobOrderFilters";
import { JobOrderEmptyState } from "@/components/job-orders/JobOrderEmptyState";

const JobOrders = () => {
  const navigate = useNavigate();
  const { data: jobOrders, isLoading, error, refetch, isFetching } = useJobOrders();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"active" | "in-progress" | "completed" | "on-hold" | "">("");

  const filteredJobOrders = jobOrders?.filter((j) => {
    const matchesSearch = j.number.toLowerCase().includes(search.toLowerCase()) ||
      j.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      j.project_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !selectedStatus || j.status === selectedStatus;
    return matchesSearch && matchesStatus;
  }) || [];

  const columns = [
    {
      key: "number",
      header: "Job Order #",
      render: (item: JobOrder) => (
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          <span className="font-medium">{item.number}</span>
        </div>
      ),
    },
    { key: "customer_name", header: "Customer" },
    { key: "project_name", header: "Project" },
    {
      key: "status",
      header: "Status",
      render: (item: JobOrder) => <StatusBadge status={item.status} />,
    },
    {
      key: "total",
      header: "Total Value",
      render: (item: JobOrder) => (
        <span className="font-semibold text-primary">
          ${item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "invoiced_amount",
      header: "Invoiced",
      render: (item: JobOrder) => (
        <span className="text-success">
          ${item.invoiced_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "remaining_amount",
      header: "Remaining",
      render: (item: JobOrder) => (
        <span className="text-warning">
          ${item.remaining_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (item: JobOrder) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/job-orders/${item.id}`);
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <>
      <SEO 
        title="Job Orders"
        description="Track and manage job orders from approved estimates"
        keywords="job orders, work orders, job tracking, project execution, job management"
      />
      <PageLayout
      title="Job Orders"
      description="Active jobs from approved estimates"
    >
      <PullToRefreshWrapper onRefresh={refetch} isRefreshing={isFetching}>
        {/* Search */}
        <div className="mb-6 relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search job orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-secondary border-border"
          />
        </div>

        {/* Loading & Error States */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        
        {error && (
          <div className="text-center py-12 text-destructive">
            Error loading job orders: {error.message}
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* Stats */}
            <JobOrderStats jobOrders={jobOrders || []} />

            {/* Filters */}
            <JobOrderFilters
              selectedStatus={selectedStatus}
              onStatusChange={setSelectedStatus}
            />

            {/* Job Orders Display */}
            {filteredJobOrders.length === 0 ? (
              <JobOrderEmptyState hasFilters={search !== "" || selectedStatus !== ""} />
            ) : isMobile ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredJobOrders.map((jobOrder, index) => (
                  <JobOrderCard
                    key={jobOrder.id}
                    jobOrder={jobOrder}
                    onClick={() => navigate(`/job-orders/${jobOrder.id}`)}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <DataTable
                data={filteredJobOrders}
                columns={columns}
                onRowClick={(item) => navigate(`/job-orders/${item.id}`)}
              />
            )}
          </>
        )}
      </PullToRefreshWrapper>
    </PageLayout>
    </>
  );
};

export default JobOrders;
