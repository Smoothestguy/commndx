import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import type { DocumentSourceType } from "@/integrations/supabase/hooks/useAllSystemDocuments";
import { DOCUMENT_SOURCE_LABELS } from "@/integrations/supabase/hooks/useAllSystemDocuments";

interface DocumentFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sourceType: DocumentSourceType | "all";
  onSourceTypeChange: (value: DocumentSourceType | "all") => void;
  relatedEntity: string;
  onRelatedEntityChange: (value: string) => void;
  uniqueEntities: string[];
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export function DocumentFilters({
  searchTerm,
  onSearchChange,
  sourceType,
  onSourceTypeChange,
  relatedEntity,
  onRelatedEntityChange,
  uniqueEntities,
  onClearFilters,
  hasActiveFilters,
}: DocumentFiltersProps) {
  const sourceTypes = Object.entries(DOCUMENT_SOURCE_LABELS);

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search documents..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Source Type Filter */}
      <Select
        value={sourceType}
        onValueChange={(v) => onSourceTypeChange(v as DocumentSourceType | "all")}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {sourceTypes.map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Related Entity Filter */}
      <Select
        value={relatedEntity || "all"}
        onValueChange={(v) => onRelatedEntityChange(v === "all" ? "" : v)}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="All Entities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Entities</SelectItem>
          {uniqueEntities.map((entity) => (
            <SelectItem key={entity} value={entity}>
              {entity}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
