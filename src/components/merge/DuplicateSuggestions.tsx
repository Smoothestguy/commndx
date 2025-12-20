import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Copy, Mail, Phone, Building2, Hash, User } from "lucide-react";
import { DuplicateMatch, EntityType, getMatchTypeLabel, getMatchTypeColor } from "@/hooks/useEntityMerge";

interface DuplicateSuggestionsProps {
  duplicates: DuplicateMatch[];
  isLoading: boolean;
  entityType: EntityType;
  onMergeClick: (duplicateId: string) => void;
}

export function DuplicateSuggestions({
  duplicates,
  isLoading,
  entityType,
  onMergeClick,
}: DuplicateSuggestionsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (duplicates.length === 0) {
    return null;
  }

  const getMatchIcon = (matchType: string) => {
    switch (matchType) {
      case "email":
        return <Mail className="h-3 w-3" />;
      case "phone":
        return <Phone className="h-3 w-3" />;
      case "tax_id":
      case "ssn":
        return <Hash className="h-3 w-3" />;
      case "name":
      case "name_company":
        return <User className="h-3 w-3" />;
      default:
        return <Copy className="h-3 w-3" />;
    }
  };

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-base">Potential Duplicates Found</CardTitle>
        </div>
        <CardDescription>
          The following records may be duplicates. Review and merge if appropriate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {duplicates.map((duplicate) => (
            <div
              key={duplicate.duplicate_id}
              className="flex items-center justify-between gap-4 p-3 bg-background rounded-lg border"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium truncate">{duplicate.duplicate_name}</span>
                  <Badge
                    variant="secondary"
                    className={`${getMatchTypeColor(duplicate.match_type)} text-white text-xs gap-1`}
                  >
                    {getMatchIcon(duplicate.match_type)}
                    {getMatchTypeLabel(duplicate.match_type)}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {duplicate.match_score}% match
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {duplicate.duplicate_email && (
                    <span className="flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3" />
                      {duplicate.duplicate_email}
                    </span>
                  )}
                  {duplicate.duplicate_phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {duplicate.duplicate_phone}
                    </span>
                  )}
                  {duplicate.duplicate_company && (
                    <span className="flex items-center gap-1 truncate">
                      <Building2 className="h-3 w-3" />
                      {duplicate.duplicate_company}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onMergeClick(duplicate.duplicate_id)}
              >
                Merge
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
