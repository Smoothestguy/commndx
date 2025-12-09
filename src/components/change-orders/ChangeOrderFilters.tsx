import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { ChangeOrderStatus } from "@/integrations/supabase/hooks/useChangeOrders";

interface ChangeOrderFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: ChangeOrderStatus | "all";
  onStatusChange: (value: ChangeOrderStatus | "all") => void;
  projects?: { id: string; name: string }[];
  projectFilter?: string;
  onProjectChange?: (value: string) => void;
}

export function ChangeOrderFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  projects,
  projectFilter,
  onProjectChange,
}: ChangeOrderFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search change orders..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={statusFilter} onValueChange={(v) => onStatusChange(v as ChangeOrderStatus | "all")}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="pending_approval">Pending Approval</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
          <SelectItem value="invoiced">Invoiced</SelectItem>
        </SelectContent>
      </Select>
      {projects && onProjectChange && (
        <Select value={projectFilter || "all"} onValueChange={onProjectChange}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
