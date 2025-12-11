import { useState } from "react";
import { Filter, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

export interface EntityFilterConfig {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

export interface SortOption {
  value: string;
  label: string;
}

export interface EnhancedFiltersProps {
  // Status filter
  statusOptions?: FilterOption[];
  statusValue?: string;
  onStatusChange?: (value: string) => void;
  statusLabel?: string;
  
  // Entity filters (customer, vendor, project, etc.)
  entityFilters?: EntityFilterConfig[];
  
  // Date range
  showDateRange?: boolean;
  dateFromValue?: string;
  dateToValue?: string;
  onDateFromChange?: (value: string) => void;
  onDateToChange?: (value: string) => void;
  dateFromLabel?: string;
  dateToLabel?: string;
  
  // Sort options
  sortOptions?: SortOption[];
  sortValue?: string;
  onSortChange?: (value: string) => void;
  sortOrderValue?: "asc" | "desc";
  onSortOrderChange?: (value: "asc" | "desc") => void;
  
  // Control
  className?: string;
  defaultOpen?: boolean;
}

export function EnhancedFilters({
  statusOptions,
  statusValue,
  onStatusChange,
  statusLabel = "Status",
  entityFilters = [],
  showDateRange = false,
  dateFromValue = "",
  dateToValue = "",
  onDateFromChange,
  onDateToChange,
  dateFromLabel = "Date From",
  dateToLabel = "Date To",
  sortOptions,
  sortValue,
  onSortChange,
  sortOrderValue = "desc",
  onSortOrderChange,
  className,
  defaultOpen = false,
}: EnhancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Calculate active filter count
  const activeFilterCount = [
    statusValue && statusValue !== "all" ? 1 : 0,
    ...entityFilters.map((f) => (f.value && f.value !== "all" ? 1 : 0)),
    dateFromValue ? 1 : 0,
    dateToValue ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const clearAllFilters = () => {
    onStatusChange?.("all");
    entityFilters.forEach((f) => f.onChange("all"));
    onDateFromChange?.("");
    onDateToChange?.("");
  };

  const hasFilters = activeFilterCount > 0;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Filter Toggle Button */}
      <div className="flex items-center gap-2">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant={hasFilters ? "default" : "outline"}
              size="sm"
              className={cn(
                "gap-2",
                hasFilters && "bg-primary text-primary-foreground"
              )}
            >
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                >
                  {activeFilterCount}
                </Badge>
              )}
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-3">
            <Card className="glass border-border">
              <CardContent className="pt-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Status Filter */}
                  {statusOptions && onStatusChange && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">{statusLabel}</Label>
                      <Select value={statusValue} onValueChange={onStatusChange}>
                        <SelectTrigger className="bg-secondary border-border">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Entity Filters */}
                  {entityFilters.map((filter, index) => (
                    <div key={index} className="space-y-2">
                      <Label className="text-sm font-medium">{filter.label}</Label>
                      <Select value={filter.value} onValueChange={filter.onChange}>
                        <SelectTrigger className="bg-secondary border-border">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          {filter.options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}

                  {/* Date Range */}
                  {showDateRange && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{dateFromLabel}</Label>
                        <Input
                          type="date"
                          value={dateFromValue}
                          onChange={(e) => onDateFromChange?.(e.target.value)}
                          className="bg-secondary border-border"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{dateToLabel}</Label>
                        <Input
                          type="date"
                          value={dateToValue}
                          onChange={(e) => onDateToChange?.(e.target.value)}
                          className="bg-secondary border-border"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Sort Options */}
                {sortOptions && onSortChange && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex flex-wrap items-center gap-4">
                      <Label className="text-sm font-medium">Sort by:</Label>
                      <Select value={sortValue} onValueChange={onSortChange}>
                        <SelectTrigger className="w-[180px] bg-secondary border-border">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {sortOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {onSortOrderChange && (
                        <Select
                          value={sortOrderValue}
                          onValueChange={(v) => onSortOrderChange(v as "asc" | "desc")}
                        >
                          <SelectTrigger className="w-[150px] bg-secondary border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="asc">Ascending</SelectItem>
                            <SelectItem value="desc">Descending</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
