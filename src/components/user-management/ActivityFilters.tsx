import { useState } from "react";
import { Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface ActivityFiltersProps {
  emailFilter: string;
  actionFilter: string;
  dateFromFilter: string;
  dateToFilter: string;
  onEmailFilterChange: (value: string) => void;
  onActionFilterChange: (value: string) => void;
  onDateFromFilterChange: (value: string) => void;
  onDateToFilterChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}

export function ActivityFilters({
  emailFilter,
  actionFilter,
  dateFromFilter,
  dateToFilter,
  onEmailFilterChange,
  onActionFilterChange,
  onDateFromFilterChange,
  onDateToFilterChange,
  onApply,
  onClear,
  hasActiveFilters,
}: ActivityFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  const actionOptions = [
    { value: "all", label: "All Actions" },
    { value: "sent", label: "Sent" },
    { value: "resent", label: "Resent" },
    { value: "accepted", label: "Accepted" },
    { value: "cancelled", label: "Cancelled" },
    { value: "expired", label: "Expired" },
    { value: "reminder_sent", label: "Reminder Sent" },
  ];

  const getActiveFiltersCount = () => {
    let count = 0;
    if (emailFilter) count++;
    if (actionFilter !== "all") count++;
    if (dateFromFilter) count++;
    if (dateToFilter) count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <div className="space-y-3 md:space-y-4 mb-4 md:mb-6 pb-4 md:pb-6 border-b">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between gap-2">
          <CollapsibleTrigger asChild>
            <Button 
              variant="outline" 
              className={cn("gap-2 min-h-[44px]", isMobile && "flex-1")}
            >
              <Filter className="h-4 w-4" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </CollapsibleTrigger>

          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClear} 
              className="gap-2 min-h-[44px]"
            >
              <X className="h-4 w-4" />
              <span className={isMobile ? "sr-only" : ""}>Clear All</span>
            </Button>
          )}
        </div>

        <CollapsibleContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mt-3 md:mt-4 p-3 md:p-4 rounded-lg bg-muted/50">
            {/* Email Filter */}
            <div className="space-y-2">
              <Label htmlFor="email-filter">Search Email</Label>
              <Input
                id="email-filter"
                type="text"
                placeholder="Filter by email..."
                value={emailFilter}
                onChange={(e) => onEmailFilterChange(e.target.value)}
                className="min-h-[44px]"
              />
            </div>

            {/* Action Type Filter */}
            <div className="space-y-2">
              <Label htmlFor="action-filter">Action Type</Label>
              <Select value={actionFilter} onValueChange={onActionFilterChange}>
                <SelectTrigger id="action-filter" className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {actionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* From Date */}
            <div className="space-y-2">
              <Label htmlFor="date-from-filter">From Date</Label>
              <Input
                id="date-from-filter"
                type="date"
                value={dateFromFilter}
                onChange={(e) => onDateFromFilterChange(e.target.value)}
                className="min-h-[44px]"
              />
            </div>

            {/* To Date */}
            <div className="space-y-2">
              <Label htmlFor="date-to-filter">To Date</Label>
              <Input
                id="date-to-filter"
                type="date"
                value={dateToFilter}
                onChange={(e) => onDateToFilterChange(e.target.value)}
                className="min-h-[44px]"
              />
            </div>

            {/* Apply Button */}
            <div className="md:col-span-2 flex justify-end">
              <Button onClick={onApply} className={cn("min-h-[44px]", isMobile && "w-full")}>
                Apply Filters
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {emailFilter && (
            <Badge variant="secondary" className="gap-1.5 py-1">
              Email: {emailFilter.length > 15 ? emailFilter.slice(0, 15) + '...' : emailFilter}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onEmailFilterChange("")}
              />
            </Badge>
          )}
          {actionFilter !== "all" && (
            <Badge variant="secondary" className="gap-1.5 py-1">
              Action: {actionOptions.find((o) => o.value === actionFilter)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onActionFilterChange("all")}
              />
            </Badge>
          )}
          {dateFromFilter && (
            <Badge variant="secondary" className="gap-1.5 py-1">
              From: {dateFromFilter}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onDateFromFilterChange("")}
              />
            </Badge>
          )}
          {dateToFilter && (
            <Badge variant="secondary" className="gap-1.5 py-1">
              To: {dateToFilter}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onDateToFilterChange("")}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
