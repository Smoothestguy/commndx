import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

interface PersonnelFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  everifyStatus: string;
  onEverifyStatusChange: (value: string) => void;
}

export const PersonnelFilters = ({
  search,
  onSearchChange,
  status,
  onStatusChange,
  everifyStatus,
  onEverifyStatusChange,
}: PersonnelFiltersProps) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or personnel number..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
          <SelectItem value="do_not_hire">Do Not Hire</SelectItem>
        </SelectContent>
      </Select>

      <Select value={everifyStatus} onValueChange={onEverifyStatusChange}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Filter by E-Verify" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All E-Verify</SelectItem>
          <SelectItem value="verified">Verified</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
          <SelectItem value="expired">Expired</SelectItem>
          <SelectItem value="not_required">Not Required</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
