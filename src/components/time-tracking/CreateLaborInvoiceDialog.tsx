import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, Check } from "lucide-react";
import { format } from "date-fns";
import { useCreateWeeklyLaborInvoice } from "@/integrations/supabase/hooks/useWeeklyLaborInvoice";
import { PersonnelWeeklySummary } from "@/integrations/supabase/hooks/useProjectLaborExpenses";
import { formatCurrency } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";

interface CreateLaborInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName?: string;
  weekStartDate: Date;
  personnelSummaries: PersonnelWeeklySummary[];
  laborExpenseIds: string[];
  defaultCustomerId?: string;
  onSuccess?: () => void;
}

export function CreateLaborInvoiceDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  weekStartDate,
  personnelSummaries,
  laborExpenseIds,
  defaultCustomerId,
  onSuccess,
}: CreateLaborInvoiceDialogProps) {
  const [selectedPersonnel, setSelectedPersonnel] = useState<Set<string>>(
    new Set(personnelSummaries.map(p => p.personnel_id))
  );
  const [customerId, setCustomerId] = useState(defaultCustomerId || "");
  
  const { data: customers = [] } = useCustomers();
  const createInvoice = useCreateWeeklyLaborInvoice();
  
  const weekLabel = format(weekStartDate, 'MMM d, yyyy');
  
  const selectedSummaries = useMemo(() => 
    personnelSummaries.filter(p => selectedPersonnel.has(p.personnel_id)),
    [personnelSummaries, selectedPersonnel]
  );
  
  const totalAmount = useMemo(() => 
    selectedSummaries.reduce((sum, p) => sum + p.total_amount, 0),
    [selectedSummaries]
  );
  
  const togglePersonnel = (personnelId: string) => {
    const newSelected = new Set(selectedPersonnel);
    if (newSelected.has(personnelId)) {
      newSelected.delete(personnelId);
    } else {
      newSelected.add(personnelId);
    }
    setSelectedPersonnel(newSelected);
  };
  
  const toggleAll = () => {
    if (selectedPersonnel.size === personnelSummaries.length) {
      setSelectedPersonnel(new Set());
    } else {
      setSelectedPersonnel(new Set(personnelSummaries.map(p => p.personnel_id)));
    }
  };
  
  const selectedCustomer = customers.find(c => c.id === customerId);
  
  const handleCreate = async () => {
    if (!customerId || selectedSummaries.length === 0) return;
    
    try {
      await createInvoice.mutateAsync({
        customerId,
        customerName: selectedCustomer?.name || '',
        projectId,
        projectName,
        weekStartDate,
        personnelSummaries: selectedSummaries,
        laborExpenseIds: laborExpenseIds.filter((_, index) => {
          const summary = personnelSummaries[index];
          return summary && selectedPersonnel.has(summary.personnel_id);
        }),
        taxRate: 0,
      });
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Error handling done in mutation
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Labor Invoice
          </DialogTitle>
          <DialogDescription>
            Create a customer invoice for labor hours worked during the week of {weekLabel}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Customer Selection */}
          <div>
            <Label htmlFor="customer">Bill To Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select customer..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name} {customer.company ? `(${customer.company})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Project Info */}
          {projectName && (
            <div>
              <Label>Project</Label>
              <p className="text-sm text-muted-foreground mt-1">{projectName}</p>
            </div>
          )}
          
          {/* Personnel Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Select Personnel to Invoice</Label>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {selectedPersonnel.size === personnelSummaries.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedPersonnel.size === personnelSummaries.length}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Personnel</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personnelSummaries.map((summary) => (
                    <TableRow 
                      key={summary.personnel_id}
                      className={!selectedPersonnel.has(summary.personnel_id) ? 'opacity-50' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedPersonnel.has(summary.personnel_id)}
                          onCheckedChange={() => togglePersonnel(summary.personnel_id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{summary.personnel_name}</TableCell>
                      <TableCell className="text-right">
                        {summary.regular_hours}h
                        {summary.overtime_hours > 0 && (
                          <span className="text-muted-foreground"> + {summary.overtime_hours}h OT</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(summary.total_amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          
          {/* Invoice Preview */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <Label className="text-sm font-medium">Invoice Line Items Preview</Label>
            <div className="mt-2 space-y-1 text-sm">
              {selectedSummaries.map((summary) => (
                <div key={summary.personnel_id} className="flex justify-between">
                  <span className="text-muted-foreground">
                    Week of {weekLabel} - {summary.personnel_name} - {summary.regular_hours}h
                    {summary.overtime_hours > 0 ? ` + ${summary.overtime_hours}h OT` : ''}
                  </span>
                  <span>{formatCurrency(summary.total_amount)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t font-medium">
                <span>Subtotal</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createInvoice.isPending}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={createInvoice.isPending || !customerId || selectedSummaries.length === 0}
          >
            {createInvoice.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Create Invoice ({formatCurrency(totalAmount)})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
