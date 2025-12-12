import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AuditLogFiltersProps {
  filters: {
    userEmail: string;
    actionType: string;
    resourceType: string;
    startDate: string;
    endDate: string;
    search: string;
  };
  onFiltersChange: (filters: {
    userEmail: string;
    actionType: string;
    resourceType: string;
    startDate: string;
    endDate: string;
    search: string;
  }) => void;
}

const ACTION_TYPES = [
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "view", label: "View" },
  { value: "approve", label: "Approve" },
  { value: "reject", label: "Reject" },
  { value: "send", label: "Send" },
  { value: "complete", label: "Complete" },
  { value: "sign_in", label: "Sign In" },
  { value: "sign_out", label: "Sign Out" },
  { value: "sign_up", label: "Sign Up" },
  { value: "payment", label: "Payment" },
  { value: "sync", label: "Sync" },
  { value: "upload", label: "Upload" },
  { value: "download", label: "Download" },
  { value: "invite", label: "Invite" },
  { value: "status_change", label: "Status Change" },
];

const RESOURCE_TYPES = [
  { value: "auth", label: "Authentication" },
  { value: "estimate", label: "Estimate" },
  { value: "invoice", label: "Invoice" },
  { value: "purchase_order", label: "Purchase Order" },
  { value: "job_order", label: "Job Order" },
  { value: "change_order", label: "Change Order" },
  { value: "vendor_bill", label: "Vendor Bill" },
  { value: "personnel", label: "Personnel" },
  { value: "vendor", label: "Vendor" },
  { value: "project", label: "Project" },
  { value: "customer", label: "Customer" },
  { value: "user", label: "User" },
  { value: "permission", label: "Permission" },
  { value: "file", label: "File" },
  { value: "quickbooks", label: "QuickBooks" },
  { value: "tm_ticket", label: "T&M Ticket" },
  { value: "time_entry", label: "Time Entry" },
];

export const AuditLogFilters = ({
  filters,
  onFiltersChange,
}: AuditLogFiltersProps) => {
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const handleClearFilters = () => {
    onFiltersChange({
      userEmail: "",
      actionType: "",
      resourceType: "",
      startDate: "",
      endDate: "",
      search: "",
    });
  };

  const hasActiveFilters =
    filters.userEmail ||
    filters.actionType ||
    filters.resourceType ||
    filters.startDate ||
    filters.endDate ||
    filters.search;

  return (
    <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Filters</h3>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear All
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="space-y-2">
          <Label>Search</Label>
          <Input
            placeholder="Email or resource #"
            value={filters.search}
            onChange={(e) =>
              onFiltersChange({ ...filters, search: e.target.value })
            }
          />
        </div>

        <div className="space-y-2">
          <Label>User Email</Label>
          <Input
            placeholder="Filter by email"
            value={filters.userEmail}
            onChange={(e) =>
              onFiltersChange({ ...filters, userEmail: e.target.value })
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Action Type</Label>
          <Select
            value={filters.actionType}
            onValueChange={(value) =>
              onFiltersChange({ ...filters, actionType: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {ACTION_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Resource Type</Label>
          <Select
            value={filters.resourceType}
            onValueChange={(value) =>
              onFiltersChange({ ...filters, resourceType: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All resources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All resources</SelectItem>
              {RESOURCE_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Start Date</Label>
          <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !filters.startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.startDate
                  ? format(new Date(filters.startDate), "PPP")
                  : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filters.startDate ? new Date(filters.startDate) : undefined}
                onSelect={(date) => {
                  onFiltersChange({
                    ...filters,
                    startDate: date ? date.toISOString() : "",
                  });
                  setStartDateOpen(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>End Date</Label>
          <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !filters.endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.endDate
                  ? format(new Date(filters.endDate), "PPP")
                  : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filters.endDate ? new Date(filters.endDate) : undefined}
                onSelect={(date) => {
                  onFiltersChange({
                    ...filters,
                    endDate: date ? date.toISOString() : "",
                  });
                  setEndDateOpen(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
};
