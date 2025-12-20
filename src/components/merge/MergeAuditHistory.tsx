import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { GitMerge, ArrowRight, Clock, User } from "lucide-react";
import { useMergeAuditHistory, EntityType, MergeAuditRecord } from "@/hooks/useEntityMerge";

interface MergeAuditHistoryProps {
  entityType: EntityType;
  entityId: string;
}

export function MergeAuditHistory({ entityType, entityId }: MergeAuditHistoryProps) {
  const { data: auditRecords, isLoading } = useMergeAuditHistory(entityType, entityId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!auditRecords || auditRecords.length === 0) {
    return null;
  }

  const getEntityName = (snapshot: Record<string, unknown>): string => {
    if (entityType === "personnel") {
      return `${snapshot.first_name || ""} ${snapshot.last_name || ""}`.trim() || "Unknown";
    }
    return (snapshot.name as string) || "Unknown";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <GitMerge className="h-4 w-4" />
          <CardTitle className="text-base">Merge History</CardTitle>
        </div>
        <CardDescription>
          Record of all merge operations involving this {entityType}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {auditRecords.map((record) => (
            <AccordionItem key={record.id} value={record.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">
                      {getEntityName(record.source_entity_snapshot)}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">
                      {getEntityName(record.target_entity_snapshot)}
                    </span>
                  </div>
                  <Badge variant={record.is_reversed ? "destructive" : "secondary"} className="text-xs">
                    {record.is_reversed ? "Reversed" : "Merged"}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pl-4 pt-2">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(record.merged_at), "PPp")}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {record.merged_by_email}
                    </span>
                  </div>

                  {record.notes && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Reason: </span>
                      {record.notes}
                    </div>
                  )}

                  {Object.keys(record.related_records_updated).length > 0 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Records updated: </span>
                      {Object.entries(record.related_records_updated)
                        .filter(([_, count]) => count > 0)
                        .map(([table, count]) => `${table.replace(/_/g, " ")}: ${count}`)
                        .join(", ")}
                    </div>
                  )}

                  {Object.keys(record.field_overrides).length > 0 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Fields from source: </span>
                      {Object.entries(record.field_overrides)
                        .filter(([_, choice]) => choice === "source")
                        .map(([field]) => field.replace(/_/g, " "))
                        .join(", ") || "None"}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
