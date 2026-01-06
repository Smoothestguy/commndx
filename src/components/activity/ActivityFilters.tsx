import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ActivityFiltersProps {
  actionType: string;
  onActionTypeChange: (value: string) => void;
  resourceType: string;
  onResourceTypeChange: (value: string) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  includeSession: boolean;
  onIncludeSessionChange: (value: boolean) => void;
}

const actionTypes = [
  { value: "all", label: "All Actions" },
  { value: "create", label: "Created" },
  { value: "update", label: "Updated" },
  { value: "delete", label: "Deleted" },
  { value: "approve", label: "Approved" },
  { value: "reject", label: "Rejected" },
  { value: "send", label: "Sent" },
  { value: "sign_in", label: "Sign In" },
  { value: "sign_out", label: "Sign Out" },
  { value: "payment", label: "Payment" },
  { value: "sync", label: "Sync" },
];

const resourceTypes = [
  { value: "all", label: "All Resources" },
  { value: "estimate", label: "Estimates" },
  { value: "invoice", label: "Invoices" },
  { value: "purchase_order", label: "Purchase Orders" },
  { value: "job_order", label: "Job Orders" },
  { value: "change_order", label: "Change Orders" },
  { value: "vendor_bill", label: "Vendor Bills" },
  { value: "time_entry", label: "Time Entries" },
  { value: "project", label: "Projects" },
  { value: "personnel", label: "Personnel" },
  { value: "vendor", label: "Vendors" },
  { value: "customer", label: "Customers" },
  { value: "auth", label: "Authentication" },
];

export function ActivityFilters({
  actionType,
  onActionTypeChange,
  resourceType,
  onResourceTypeChange,
  dateRange,
  onDateRangeChange,
  includeSession,
  onIncludeSessionChange,
}: ActivityFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={actionType} onValueChange={onActionTypeChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Action type" />
        </SelectTrigger>
        <SelectContent>
          {actionTypes.map((type) => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={resourceType} onValueChange={onResourceTypeChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Resource type" />
        </SelectTrigger>
        <SelectContent>
          {resourceTypes.map((type) => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[240px] justify-start text-left font-normal",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}
                </>
              ) : (
                format(dateRange.from, "LLL dd, y")
              )
            ) : (
              "Date range"
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={onDateRangeChange}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>

      <div className="flex items-center gap-2">
        <Switch
          id="include-session"
          checked={includeSession}
          onCheckedChange={onIncludeSessionChange}
        />
        <Label htmlFor="include-session" className="text-sm">
          Include navigation
        </Label>
      </div>

      {(actionType !== "all" || resourceType !== "all" || dateRange) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onActionTypeChange("all");
            onResourceTypeChange("all");
            onDateRangeChange(undefined);
          }}
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
