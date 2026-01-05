import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, AlertTriangle } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { useWeeklyPersonnelSummary } from "@/integrations/supabase/hooks/useProjectLaborExpenses";
import { useCloseWeek } from "@/integrations/supabase/hooks/useWeekCloseouts";
import { useCreateLaborExpenses } from "@/integrations/supabase/hooks/useProjectLaborExpenses";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { formatCurrency } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface WeekCloseoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  customerId: string;
  currentWeek: Date;
  onSuccess?: () => void;
}

export function WeekCloseoutDialog({
  open,
  onOpenChange,
  projectId,
  customerId,
  currentWeek,
  onSuccess,
}: WeekCloseoutDialogProps) {
  const [notes, setNotes] = useState("");
  
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  
  const { data: companySettings } = useCompanySettings();
  const holidayMultiplier = companySettings?.holiday_multiplier ?? 2.0;
  
  const { data: personnelSummaries = [], isLoading } = useWeeklyPersonnelSummary(projectId, currentWeek, holidayMultiplier);
  const closeWeek = useCloseWeek();
  const createLaborExpenses = useCreateLaborExpenses();
  
  const totalRegularHours = personnelSummaries.reduce((sum, p) => sum + p.regular_hours, 0);
  const totalOvertimeHours = personnelSummaries.reduce((sum, p) => sum + p.overtime_hours, 0);
  const totalHolidayHours = personnelSummaries.reduce((sum, p) => sum + p.holiday_hours, 0);
  const totalLaborCost = personnelSummaries.reduce((sum, p) => sum + p.total_amount, 0);
  
  const handleClose = async () => {
    try {
      // Close the week first
      const closeout = await closeWeek.mutateAsync({
        projectId,
        customerId,
        weekStartDate: currentWeek,
        notes: notes || undefined,
      });
      
      // Create labor expenses for each personnel
      if (personnelSummaries.length > 0) {
        await createLaborExpenses.mutateAsync({
          projectId,
          customerId,
          weekCloseoutId: closeout.id,
          weekStartDate: currentWeek,
          personnelSummaries,
        });
      }
      
      onOpenChange(false);
      setNotes("");
      onSuccess?.();
    } catch (error) {
      // Error handling is done in the mutations
    }
  };
  
  const isPending = closeWeek.isPending || createLaborExpenses.isPending;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Close Week: {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </DialogTitle>
          <DialogDescription>
            Closing the week will lock all time entries and create billable labor expense records.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-500">This action will:</p>
              <ul className="list-disc list-inside mt-1 text-muted-foreground">
                <li>Lock all time entries for this week (no edits allowed)</li>
                <li>Create labor expense records for each personnel</li>
                <li>Mark hours as ready for invoicing</li>
              </ul>
            </div>
          </div>
          
          {/* Personnel Summary */}
          <div>
            <Label className="text-sm font-medium">Personnel Hours Summary</Label>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : personnelSummaries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No time entries found for this project and week.
              </p>
            ) : (
              <div className="mt-2 border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Personnel</TableHead>
                      <TableHead className="text-right">Regular</TableHead>
                      <TableHead className="text-right">OT</TableHead>
                      <TableHead className="text-right">HO</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {personnelSummaries.map((summary) => (
                      <TableRow key={summary.personnel_id}>
                        <TableCell className="font-medium">{summary.personnel_name}</TableCell>
                        <TableCell className="text-right">{summary.regular_hours}h</TableCell>
                        <TableCell className="text-right text-amber-600">
                          {summary.overtime_hours > 0 ? `${summary.overtime_hours}h` : '-'}
                        </TableCell>
                        <TableCell className="text-right text-purple-600">
                          {summary.holiday_hours > 0 ? `${summary.holiday_hours}h` : '-'}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(summary.hourly_rate)}/hr</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(summary.total_amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold">{totalRegularHours}h</TableCell>
                      <TableCell className="text-right font-bold text-amber-600">
                        {totalOvertimeHours > 0 ? `${totalOvertimeHours}h` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-bold text-purple-600">
                        {totalHolidayHours > 0 ? `${totalHolidayHours}h` : '-'}
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(totalLaborCost)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          
          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this week closeout..."
              className="mt-1.5"
              rows={3}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleClose} disabled={isPending || personnelSummaries.length === 0}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Closing Week...
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Close Week & Create Expenses
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
