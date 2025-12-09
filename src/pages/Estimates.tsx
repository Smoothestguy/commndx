import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, FileText, Loader2, Edit } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
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

  // Count drafts
  const draftCount = estimates?.filter(e => e.status === "draft").length || 0;

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
          <FileText className={`h-4 w-4 ${item.status === 'draft' ? 'text-amber-500' : 'text-primary'}`} />
          <span className="font-medium">{item.number}</span>
          {item.status === "draft" && (
            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
              Draft
            </Badge>
          )}
        </div>
      ),
    },
    { 
      key: "customer_name", 
      header: "Customer",
      render: (item: Estimate) => (
        <span className={item.customer_name === "Draft" ? "text-muted-foreground italic" : ""}>
          {item.customer_name === "Draft" ? "No customer" : item.customer_name}
        </span>
      ),
    },
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
        <span className={`font-semibold ${item.status === 'draft' ? 'text-amber-600 dark:text-amber-400' : 'text-primary'}`}>
          ${item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    
    {
      key: "actions",
      header: "",
      render: (item: Estimate) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/estimates/${item.id}`);
            }}
            title="View details"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              item.status === "draft"
                ? navigate(`/estimates/new?draft=${item.id}`)
                : navigate(`/estimates/${item.id}/edit`);
            }}
            title="Edit estimate"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const handleRowClick = (item: Estimate) => {
    navigate(`/estimates/${item.id}`);
  };

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
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <SearchInput
            placeholder="Search estimates..."
            value={search}
            onChange={setSearch}
            className="bg-secondary border-border max-w-md"
          />
          {draftCount > 0 && (
            <Button
              variant={selectedStatus === "draft" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus(selectedStatus === "draft" ? "" : "draft")}
              className="whitespace-nowrap"
            >
              <FileText className="h-4 w-4 mr-1" />
              My Drafts ({draftCount})
            </Button>
          )}
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
                    onClick={() => handleRowClick(estimate)}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <DataTable
                data={filteredEstimates}
                columns={columns}
                onRowClick={handleRowClick}
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
