import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { VendorBillFilters as FilterType } from "@/integrations/supabase/hooks/useVendorBills";

interface VendorBillFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
}

export function VendorBillFilters({ filters, onFiltersChange }: VendorBillFiltersProps) {
  const { data: vendors } = useVendors();
  const { data: projects } = useProjects();

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasFilters = Object.values(filters).some(v => v !== undefined && v !== "");

  return (
    <div className="w-full max-w-full overflow-hidden space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-4 sm:items-end">
        <div className="space-y-1.5">
          <Label className="text-xs sm:text-sm">Status</Label>
          <Select
            value={filters.status || "all"}
            onValueChange={(value) => onFiltersChange({ 
              ...filters, 
              status: value === "all" ? undefined : value as any 
            })}
          >
            <SelectTrigger className="w-full sm:w-[140px] truncate">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="partially_paid">Partial</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="void">Void</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs sm:text-sm">Vendor</Label>
          <Select
            value={filters.vendor_id || "all"}
            onValueChange={(value) => onFiltersChange({ 
              ...filters, 
              vendor_id: value === "all" ? undefined : value 
            })}
          >
            <SelectTrigger className="w-full sm:w-[180px] truncate">
              <SelectValue placeholder="All vendors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              {vendors?.map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs sm:text-sm">Project</Label>
          <Select
            value={filters.project_id || "all"}
            onValueChange={(value) => onFiltersChange({ 
              ...filters, 
              project_id: value === "all" ? undefined : value 
            })}
          >
            <SelectTrigger className="w-full sm:w-[180px] truncate">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects?.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs sm:text-sm">From Date</Label>
          <Input
            type="date"
            value={filters.start_date || ""}
            onChange={(e) => onFiltersChange({ ...filters, start_date: e.target.value || undefined })}
            className="w-full sm:w-[150px]"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs sm:text-sm">To Date</Label>
          <Input
            type="date"
            value={filters.end_date || ""}
            onChange={(e) => onFiltersChange({ ...filters, end_date: e.target.value || undefined })}
            className="w-full sm:w-[150px]"
          />
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="col-span-2 sm:col-span-1">
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
