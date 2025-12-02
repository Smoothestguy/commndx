import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Eye, FileText, Loader2 } from "lucide-react";
import { useEstimates, Estimate } from "@/integrations/supabase/hooks/useEstimates";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import { useIsMobile } from "@/hooks/use-mobile";
import { EstimateCard } from "@/components/estimates/EstimateCard";
import { EstimateStats } from "@/components/estimates/EstimateStats";
import { EstimateFilters } from "@/components/estimates/EstimateFilters";
import { EstimateEmptyState } from "@/components/estimates/EstimateEmptyState";

const Estimates = () => {
  const navigate = useNavigate();
  const { data: estimates, isLoading, error, refetch, isFetching } = useEstimates();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"draft" | "pending" | "approved" | "sent" | "">("");

  const filteredEstimates = estimates?.filter((e) => {
    const matchesSearch = e.number.toLowerCase().includes(search.toLowerCase()) ||
      e.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      (e.project_name && e.project_name.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = !selectedStatus || e.status === selectedStatus;
    return matchesSearch && matchesStatus;
  }) || [];

  const columns = [
    {
      key: "number",
      header: "Estimate #",
      render: (item: Estimate) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-medium">{item.number}</span>
        </div>
      ),
    },
    { key: "customer_name", header: "Customer" },
    { key: "project_name", header: "Project" },
    {
      key: "status",
      header: "Status",
      render: (item: Estimate) => <StatusBadge status={item.status} />,
    },
    { key: "valid_until", header: "Valid Until" },
    {
      key: "total",
      header: "Total",
      render: (item: Estimate) => (
        <span className="font-semibold text-primary">
          ${item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    
    {
      key: "actions",
      header: "",
      render: (item: Estimate) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/estimates/${item.id}`);
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
        title="Estimates"
        description="Create and manage project estimates for customers"
        keywords="estimates, project estimates, quotations, pricing, customer estimates"
      />
      <PageLayout
      title="Estimates"
      description="Create and manage project estimates"
      actions={
        <Button variant="glow" onClick={() => navigate("/estimates/new")}>
          <Plus className="h-4 w-4" />
          New Estimate
        </Button>
      }
    >
      <PullToRefreshWrapper onRefresh={refetch} isRefreshing={isFetching}>
        {/* Search */}
        <div className="mb-6 relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search estimates..."
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
            Error loading estimates: {error.message}
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* Stats */}
            <EstimateStats estimates={estimates || []} />

            {/* Filters */}
            <EstimateFilters
              selectedStatus={selectedStatus}
              onStatusChange={setSelectedStatus}
            />

            {/* Estimates Display */}
            {filteredEstimates.length === 0 ? (
              <EstimateEmptyState
                onCreateEstimate={() => navigate("/estimates/new")}
                hasFilters={search !== "" || selectedStatus !== ""}
              />
            ) : isMobile ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredEstimates.map((estimate, index) => (
                  <EstimateCard
                    key={estimate.id}
                    estimate={estimate}
                    onClick={() => navigate(`/estimates/${estimate.id}`)}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <DataTable
                data={filteredEstimates}
                columns={columns}
                onRowClick={(item) => navigate(`/estimates/${item.id}`)}
              />
            )}
          </>
        )}
      </PullToRefreshWrapper>
    </PageLayout>
    </>
  );
};

export default Estimates;
