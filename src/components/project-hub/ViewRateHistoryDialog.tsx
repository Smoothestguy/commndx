import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, History, DollarSign } from "lucide-react";
import { usePersonnelRateHistory, RATE_CHANGE_REASONS } from "@/integrations/supabase/hooks/usePersonnelRateHistory";
import { formatCurrency } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ViewRateHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  personnelId: string;
  personnelName: string;
}

export function ViewRateHistoryDialog({
  open,
  onOpenChange,
  projectId,
  personnelId,
  personnelName,
}: ViewRateHistoryDialogProps) {
  const { data: history = [], isLoading } = usePersonnelRateHistory(
    projectId,
    personnelId
  );

  const getReasonLabel = (value: string | null): string => {
    if (!value) return "—";
    const reason = RATE_CHANGE_REASONS.find((r) => r.value === value);
    return reason?.label ?? value;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Pay Rate History
          </DialogTitle>
          <DialogDescription>
            Historical pay rates for <strong>{personnelName}</strong> on this
            project.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No rate history found</p>
            <p className="text-sm mt-1">
              Rate history will appear here after the first rate is set.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rate</TableHead>
                  <TableHead>Effective From</TableHead>
                  <TableHead>Effective To</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((record, index) => {
                  const isActive = record.effective_to === null;

                  return (
                    <TableRow
                      key={record.id}
                      className={isActive ? "bg-primary/5" : ""}
                    >
                      <TableCell className="font-medium">
                        {formatCurrency(record.pay_rate)}/hr
                        {isActive && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            Current
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(
                          new Date(record.effective_from),
                          "MMM d, yyyy h:mm a"
                        )}
                      </TableCell>
                      <TableCell>
                        {record.effective_to
                          ? format(
                              new Date(record.effective_to),
                              "MMM d, yyyy h:mm a"
                            )
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm">
                            {getReasonLabel(record.change_reason)}
                          </p>
                          {record.notes && (
                            <p className="text-xs text-muted-foreground">
                              {record.notes}
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
