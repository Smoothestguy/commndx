import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchInput } from "@/components/ui/search-input";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";

interface PersonnelFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  everifyStatus: string;
  onEverifyStatusChange: (value: string) => void;
  vendorId?: string;
  onVendorChange?: (value: string) => void;
}

export const PersonnelFilters = ({
  search,
  onSearchChange,
  status,
  onStatusChange,
  everifyStatus,
  onEverifyStatusChange,
  vendorId,
  onVendorChange,
}: PersonnelFiltersProps) => {
  const { data: vendors } = useVendors();

  return (
    <div className="flex flex-col gap-2 sm:gap-3">
      {/* Search - full width */}
      <SearchInput
        placeholder="Search name, email, ID..."
        value={search}
        onChange={onSearchChange}
        className="min-h-[44px] sm:min-h-[40px] w-full"
      />

      {/* Filters - grid on mobile (2 columns), flex row on desktop */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-full sm:w-[140px] md:w-[160px] min-h-[44px] sm:min-h-[40px] text-xs sm:text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="do_not_hire">DNH</SelectItem>
          </SelectContent>
        </Select>

        <Select value={everifyStatus} onValueChange={onEverifyStatusChange}>
          <SelectTrigger className="w-full sm:w-[140px] md:w-[160px] min-h-[44px] sm:min-h-[40px] text-xs sm:text-sm">
            <SelectValue placeholder="E-Verify" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All E-Verify</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="not_required">N/A</SelectItem>
          </SelectContent>
        </Select>

        {onVendorChange && (
          <Select value={vendorId || "all"} onValueChange={onVendorChange}>
            <SelectTrigger className="w-full col-span-2 sm:col-span-1 sm:w-[140px] md:w-[160px] min-h-[44px] sm:min-h-[40px] text-xs sm:text-sm">
              <SelectValue placeholder="Vendor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {vendors?.map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
};
