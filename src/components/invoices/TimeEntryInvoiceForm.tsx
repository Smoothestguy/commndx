import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAllTimeEntries } from "@/integrations/supabase/hooks/useTimeEntries";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { useAddInvoice } from "@/integrations/supabase/hooks/useInvoices";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { getNextInvoiceNumber } from "@/utils/invoiceNumberGenerator";

export const TimeEntryInvoiceForm = () => {
  const navigate = useNavigate();
  const { data: projects } = useProjects();
  const addInvoice = useAddInvoice();

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [margin, setMargin] = useState(0);
  const [taxRate, setTaxRate] = useState(0);

  const { data: timeEntries, isLoading } = useAllTimeEntries(selectedProjectId);

  const filteredEntries = timeEntries?.filter((entry) => {
    if (selectedProjectId === entry.project_id) {
      if (startDate && entry.entry_date < startDate) return false;
      if (endDate && entry.entry_date > endDate) return false;
      return true;
    }
    return false;
  });

  const selectedEntriesData = filteredEntries?.filter((entry) =>
    selectedEntries.has(entry.id)
  );

  const subtotal = selectedEntriesData?.reduce((sum, entry) => {
    const rate = entry.profiles?.hourly_rate || 0;
    return sum + (Number(entry.hours) * rate);
  }, 0) || 0;

  // Margin-based pricing: subtotalWithMargin = subtotal / (1 - margin/100)
  const subtotalWithMargin = margin > 0 && margin < 100 ? subtotal / (1 - margin / 100) : subtotal;
  const marginAmount = subtotalWithMargin - subtotal;
  const taxAmount = subtotalWithMargin * (taxRate / 100);
  const total = subtotalWithMargin + taxAmount;

  const handleToggleEntry = (entryId: string) => {
    const newSelected = new Set(selectedEntries);
    if (newSelected.has(entryId)) {
      newSelected.delete(entryId);
    } else {
      newSelected.add(entryId);
    }
    setSelectedEntries(newSelected);
  };

  const handleSubmit = async () => {
    if (!selectedProjectId || selectedEntries.size === 0) {
      toast.error("Please select a project and at least one time entry");
      return;
    }

    const project = projects?.find((p) => p.id === selectedProjectId);
    if (!project) return;

    try {
      // Get fresh invoice number from QuickBooks (or local fallback)
      const { number: invoiceNumber, source } = await getNextInvoiceNumber();
      console.log(`Generated invoice number ${invoiceNumber} from ${source}`);

      const lineItems = selectedEntriesData?.map((entry) => {
        const rate = entry.profiles?.hourly_rate || 0;
        const hours = Number(entry.hours);
        const baseTotal = hours * rate;
        // Margin-based pricing
        const itemTotal = margin > 0 && margin < 100 ? baseTotal / (1 - margin / 100) : baseTotal;
        return {
          description: `${entry.profiles?.first_name} ${entry.profiles?.last_name} - ${entry.description || "Time entry"} (${hours} hrs)`,
          quantity: hours,
          unit_price: rate,
          markup: margin, // DB column is still "markup"
          total: itemTotal,
        };
      }) || [];

      await addInvoice.mutateAsync({
        customer_id: project.customer_id,
        customer_name: "", // Will be filled by backend
        project_name: project.name,
        number: invoiceNumber, // Use QuickBooks-synced number
        subtotal: subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total: total,
        due_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
        status: "draft",
        line_items: lineItems as any,
      });

      toast.success("Invoice created successfully");
      navigate("/invoices");
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast.error("Failed to create invoice");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Select Time Entries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="project">Project</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger id="project">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEntries && filteredEntries.length > 0 ? (
            <div className="border border-border rounded-lg">
              <div className="max-h-96 overflow-y-auto">
                {filteredEntries.map((entry) => {
                  const rate = entry.profiles?.hourly_rate || 0;
                  const hours = Number(entry.hours);
                  const amount = hours * rate;

                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-4 p-4 border-b border-border last:border-0 hover:bg-accent/50"
                    >
                      <Checkbox
                        checked={selectedEntries.has(entry.id)}
                        onCheckedChange={() => handleToggleEntry(entry.id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium">
                          {entry.profiles?.first_name} {entry.profiles?.last_name} - {format(new Date(entry.entry_date), "MMM d, yyyy")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {entry.description || "No description"} • {hours} hrs @ ${rate}/hr
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${amount.toFixed(2)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {selectedProjectId
                ? "No unbilled time entries found for this project"
                : "Please select a project to view time entries"}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="margin">Margin (%)</Label>
              <Input
                id="margin"
                type="number"
                step="0.1"
                max="99.99"
                value={margin}
                onChange={(e) => setMargin(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax-rate">Tax Rate (%)</Label>
              <Input
                id="tax-rate"
                type="number"
                step="0.1"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {margin > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Margin ({margin}%):</span>
                <span>${marginAmount.toFixed(2)}</span>
              </div>
            )}
            {taxRate > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Tax ({taxRate}%):</span>
                <span>${taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/invoices")}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={selectedEntries.size === 0 || addInvoice.isPending}
              className="flex-1"
            >
              {addInvoice.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Invoice
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
