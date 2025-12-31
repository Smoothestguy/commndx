import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { EnhancedDataTable, EnhancedColumn } from "@/components/shared/EnhancedDataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, FileText, Loader2, Edit } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { useEstimates, Estimate } from "@/integrations/supabase/hooks/useEstimates";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import { useIsMobile } from "@/hooks/use-mobile";
import { EstimateCard } from "@/components/estimates/EstimateCard";
import { EstimateStats } from "@/components/estimates/EstimateStats";
import { EstimateEmptyState } from "@/components/estimates/EstimateEmptyState";

const Estimates = () => {
  const navigate = useNavigate();
  const { data: estimates, isLoading, error, refetch, isFetching } = useEstimates();
  const { data: customers } = useCustomers();
  const { data: projects } = useProjects();
  const isMobile = useIsMobile();
  
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Count drafts
  const draftCount = estimates?.filter(e => e.status === "draft").length || 0;

  const filteredEstimates = useMemo(() => {
    return estimates?.filter((e) => {
      const matchesSearch = e.number.toLowerCase().includes(search.toLowerCase()) ||
        e.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        (e.project_name && e.project_name.toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = selectedStatus === "all" || e.status === selectedStatus;
      
      return matchesSearch && matchesStatus;
    }) || [];
  }, [estimates, search, selectedStatus]);

  const hasActiveFilters = selectedStatus !== "all" || !!search;

  const columns: EnhancedColumn<Estimate>[] = [
    {
      key: "number",
      header: "Estimate #",
      sortable: true,
      filterable: true,
      getValue: (item) => item.number,
      render: (item) => (
        <div className="flex items-center gap-2">
          <FileText className={`h-4 w-4 ${item.status === 'draft' ? 'text-amber-500' : 'text-primary'}`} />
          <Link
            to={`/estimates/${item.id}`}
            className="font-medium text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {item.number}
          </Link>
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
      sortable: true,
      filterable: true,
      getValue: (item) => item.customer_name,
      render: (item) => {
        if (item.customer_name === "Draft") {
          return <span className="text-muted-foreground italic">No customer</span>;
        }
        return (
          <Link
            to={`/customers/${item.customer_id}`}
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {item.customer_name}
          </Link>
        );
      },
    },
    { 
      key: "project_name", 
      header: "Project",
      sortable: true,
      filterable: true,
      getValue: (item) => item.project_name || "",
      render: (item) => {
        if (!item.project_name || !item.project_id) {
          return <span className="text-muted-foreground">-</span>;
        }
        return (
          <Link
            to={`/projects/${item.project_id}`}
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {item.project_name}
          </Link>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      filterable: true,
      getValue: (item) => item.status,
      render: (item) => <StatusBadge status={item.status} />,
    },
    { 
      key: "valid_until", 
      header: "Valid Until",
      sortable: true,
      filterable: false,
      getValue: (item) => item.valid_until,
      render: (item) => new Date(item.valid_until).toLocaleDateString(),
    },
    {
      key: "total",
      header: "Total",
      sortable: true,
      filterable: false,
      getValue: (item) => item.total,
      render: (item) => (
        <span className={`font-semibold ${item.status === 'draft' ? 'text-amber-600 dark:text-amber-400' : 'text-primary'}`}>
          ${item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      sortable: false,
      filterable: false,
      render: (item) => (
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
              navigate(`/estimates/${item.id}/edit`);
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
          {/* Search & Filter Controls */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 max-w-md">
                <SearchInput
                  placeholder="Search estimates..."
                  value={search}
                  onChange={setSearch}
                  className="bg-secondary border-border"
                />
              </div>
              {draftCount > 0 && (
                <Button
                  variant={selectedStatus === "draft" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedStatus(selectedStatus === "draft" ? "all" : "draft")}
                  className="whitespace-nowrap"
                >
                  <FileText className="h-4 w-4 mr-1" />
                  My Drafts ({draftCount})
                </Button>
              )}
            </div>
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

              {/* Estimates Display */}
              {filteredEstimates.length === 0 ? (
                <EstimateEmptyState
                  onCreateEstimate={() => navigate("/estimates/new")}
                  hasFilters={hasActiveFilters}
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
                <EnhancedDataTable
                  tableId="estimates"
                  data={filteredEstimates}
                  columns={columns}
                  onRowClick={handleRowClick}
                  defaultSortKey="number"
                  defaultSortDirection="desc"
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
