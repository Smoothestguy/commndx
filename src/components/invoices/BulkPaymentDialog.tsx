import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Invoice,
  BulkPaymentItem,
  useBulkAddInvoicePayments,
} from "@/integrations/supabase/hooks/useInvoices";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import {
  Loader2,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Receipt,
  ChevronRight,
} from "lucide-react";

const PAYMENT_METHODS = [
  "Check",
  "Cash",
  "Credit Card",
  "ACH",
  "Wire Transfer",
  "Other",
];

interface BulkPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoices: Invoice[];
  selectedIds: Set<string>;
  onClearSelection: () => void;
}

type Step = "configure" | "review" | "results";

interface PaymentConfig {
  invoice_id: string;
  payment_amount: string;
  use_custom: boolean;
  custom_date?: string;
  custom_method?: string;
  custom_reference?: string;
  custom_notes?: string;
}

export function BulkPaymentDialog({
  open,
  onOpenChange,
  invoices,
  selectedIds,
  onClearSelection,
}: BulkPaymentDialogProps) {
  const [step, setStep] = useState<Step>("configure");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Global payment settings
  const [globalDate, setGlobalDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [globalMethod, setGlobalMethod] = useState("Check");
  const [globalReference, setGlobalReference] = useState("");
  const [globalNotes, setGlobalNotes] = useState("");
  const [payFullAmount, setPayFullAmount] = useState(true);

  // Per-invoice configs
  const [paymentConfigs, setPaymentConfigs] = useState<
    Map<string, PaymentConfig>
  >(new Map());

  // Results from submission
  const [results, setResults] = useState<
    {
      invoice_id: string;
      invoice_number: string;
      success: boolean;
      error?: string;
    }[]
  >([]);

  const bulkPayment = useBulkAddInvoicePayments();

  // Get selected invoices with remaining balance
  const selectedInvoices = useMemo(() => {
    return invoices.filter(
      (inv) => selectedIds.has(inv.id) && (inv.remaining_amount || 0) > 0
    );
  }, [invoices, selectedIds]);

  // Initialize payment configs when selection changes
  useEffect(() => {
    const newConfigs = new Map<string, PaymentConfig>();
    selectedInvoices.forEach((inv) => {
      const existing = paymentConfigs.get(inv.id);
      newConfigs.set(
        inv.id,
        existing || {
          invoice_id: inv.id,
          payment_amount: (inv.remaining_amount || 0).toFixed(2),
          use_custom: false,
        }
      );
    });
    setPaymentConfigs(newConfigs);
  }, [selectedInvoices.length]);

  // Update all amounts when payFullAmount changes
  useEffect(() => {
    if (payFullAmount) {
      const newConfigs = new Map(paymentConfigs);
      selectedInvoices.forEach((inv) => {
        const config = newConfigs.get(inv.id);
        if (config) {
          newConfigs.set(inv.id, {
            ...config,
            payment_amount: (inv.remaining_amount || 0).toFixed(2),
          });
        }
      });
      setPaymentConfigs(newConfigs);
    }
  }, [payFullAmount]);

  const updateConfig = (invoiceId: string, updates: Partial<PaymentConfig>) => {
    const newConfigs = new Map(paymentConfigs);
    const existing = newConfigs.get(invoiceId) || {
      invoice_id: invoiceId,
      payment_amount: "0",
      use_custom: false,
    };
    newConfigs.set(invoiceId, { ...existing, ...updates });
    setPaymentConfigs(newConfigs);
  };

  // Calculate totals
  const totals = useMemo(() => {
    let totalRemaining = 0;
    let totalPayment = 0;
    let validCount = 0;
    let invalidCount = 0;

    selectedInvoices.forEach((inv) => {
      totalRemaining += inv.remaining_amount || 0;
      const config = paymentConfigs.get(inv.id);
      const amount = parseFloat(config?.payment_amount || "0");
      if (
        !isNaN(amount) &&
        amount > 0 &&
        amount <= (inv.remaining_amount || 0)
      ) {
        totalPayment += amount;
        validCount++;
      } else if (amount > 0) {
        invalidCount++;
      }
    });

    return { totalRemaining, totalPayment, validCount, invalidCount };
  }, [selectedInvoices, paymentConfigs]);

  const handleSubmit = () => {
    setShowConfirmDialog(true);
  };

  const executePayments = async () => {
    setShowConfirmDialog(false);

    const payments: BulkPaymentItem[] = selectedInvoices
      .map((inv) => {
        const config = paymentConfigs.get(inv.id);
        if (!config) return null;

        const amount = parseFloat(config.payment_amount);
        if (
          isNaN(amount) ||
          amount <= 0 ||
          amount > (inv.remaining_amount || 0)
        ) {
          return null;
        }

        return {
          invoice_id: inv.id,
          invoice_number: inv.number,
          customer_name: inv.customer_name,
          remaining_amount: inv.remaining_amount || 0,
          payment_amount: amount,
          payment_date:
            config.use_custom && config.custom_date
              ? config.custom_date
              : globalDate,
          payment_method:
            config.use_custom && config.custom_method
              ? config.custom_method
              : globalMethod,
          reference_number: config.use_custom
            ? config.custom_reference
            : globalReference || null,
          notes: config.use_custom ? config.custom_notes : globalNotes || null,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    const result = await bulkPayment.mutateAsync(payments);
    setResults(result);
    setStep("results");
  };

  const handleClose = () => {
    if (step === "results") {
      const successCount = results.filter((r) => r.success).length;
      if (successCount > 0) {
        onClearSelection();
      }
    }
    setStep("configure");
    setResults([]);
    setGlobalReference("");
    setGlobalNotes("");
    onOpenChange(false);
  };

  const renderConfigureStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Bulk Payment Recording
        </DialogTitle>
        <DialogDescription>
          Record payments for {selectedInvoices.length} invoice(s) with a total
          outstanding balance of {formatCurrency(totals.totalRemaining)}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        {/* Global Settings */}
        <div className="space-y-4 p-4 rounded-lg bg-muted/50">
          <h4 className="font-medium text-sm">Default Payment Settings</h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="global_date">Payment Date</Label>
              <Input
                id="global_date"
                type="date"
                value={globalDate}
                onChange={(e) => setGlobalDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="global_method">Payment Method</Label>
              <Select value={globalMethod} onValueChange={setGlobalMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="global_reference">Reference Number</Label>
              <Input
                id="global_reference"
                placeholder="Check #, Confirmation #, etc."
                value={globalReference}
                onChange={(e) => setGlobalReference(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="global_notes">Notes</Label>
              <Input
                id="global_notes"
                placeholder="Optional notes..."
                value={globalNotes}
                onChange={(e) => setGlobalNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="pay_full"
              checked={payFullAmount}
              onCheckedChange={(checked) => setPayFullAmount(!!checked)}
            />
            <Label htmlFor="pay_full" className="text-sm cursor-pointer">
              Pay full remaining balance for all invoices
            </Label>
          </div>
        </div>

        <Separator />

        {/* Invoice List */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Invoices to Pay</h4>
          <ScrollArea className="h-[280px] pr-4">
            <Accordion type="multiple" className="space-y-2">
              {selectedInvoices.map((inv) => {
                const config = paymentConfigs.get(inv.id);
                const amount = parseFloat(config?.payment_amount || "0");
                const isValid =
                  !isNaN(amount) &&
                  amount > 0 &&
                  amount <= (inv.remaining_amount || 0);
                const hasError =
                  !isNaN(amount) && amount > (inv.remaining_amount || 0);

                return (
                  <AccordionItem
                    key={inv.id}
                    value={inv.id}
                    className="border rounded-lg px-4"
                  >
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <Receipt className="h-4 w-4 text-muted-foreground" />
                          <div className="text-left">
                            <div className="font-medium">{inv.number}</div>
                            <div className="text-sm text-muted-foreground">
                              {inv.customer_name}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">
                              Balance
                            </div>
                            <div className="font-medium">
                              {formatCurrency(inv.remaining_amount || 0)}
                            </div>
                          </div>
                          <div className="w-32">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max={inv.remaining_amount || 0}
                              value={config?.payment_amount || ""}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateConfig(inv.id, {
                                  payment_amount: e.target.value,
                                });
                                setPayFullAmount(false);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className={hasError ? "border-destructive" : ""}
                              placeholder="$0.00"
                            />
                          </div>
                          {isValid && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          {hasError && (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`custom_${inv.id}`}
                            checked={config?.use_custom || false}
                            onCheckedChange={(checked) =>
                              updateConfig(inv.id, { use_custom: !!checked })
                            }
                          />
                          <Label
                            htmlFor={`custom_${inv.id}`}
                            className="text-sm"
                          >
                            Use custom settings for this invoice
                          </Label>
                        </div>
                        {config?.use_custom && (
                          <div className="grid grid-cols-2 gap-3 pl-6">
                            <div className="space-y-1">
                              <Label className="text-xs">Date</Label>
                              <Input
                                type="date"
                                value={config.custom_date || globalDate}
                                onChange={(e) =>
                                  updateConfig(inv.id, {
                                    custom_date: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Method</Label>
                              <Select
                                value={config.custom_method || globalMethod}
                                onValueChange={(v) =>
                                  updateConfig(inv.id, { custom_method: v })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PAYMENT_METHODS.map((m) => (
                                    <SelectItem key={m} value={m}>
                                      {m}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Reference</Label>
                              <Input
                                value={config.custom_reference || ""}
                                onChange={(e) =>
                                  updateConfig(inv.id, {
                                    custom_reference: e.target.value,
                                  })
                                }
                                placeholder="Reference #"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Notes</Label>
                              <Input
                                value={config.custom_notes || ""}
                                onChange={(e) =>
                                  updateConfig(inv.id, {
                                    custom_notes: e.target.value,
                                  })
                                }
                                placeholder="Notes"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </ScrollArea>
        </div>

        {/* Summary */}
        <div className="p-4 rounded-lg bg-primary/5 border">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm text-muted-foreground">
                Total Payment Amount
              </div>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(totals.totalPayment)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">
                {totals.validCount} of {selectedInvoices.length} invoices ready
              </div>
              {totals.invalidCount > 0 && (
                <div className="text-sm text-destructive">
                  {totals.invalidCount} with errors
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          onClick={() => setStep("review")}
          disabled={totals.validCount === 0}
        >
          Review Payments
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </DialogFooter>
    </>
  );

  const renderReviewStep = () => {
    const validPayments = selectedInvoices.filter((inv) => {
      const config = paymentConfigs.get(inv.id);
      const amount = parseFloat(config?.payment_amount || "0");
      return (
        !isNaN(amount) && amount > 0 && amount <= (inv.remaining_amount || 0)
      );
    });

    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Review Payments
          </DialogTitle>
          <DialogDescription>
            Please review the following {validPayments.length} payment(s) before
            submitting.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4 py-4">
          <div className="space-y-3">
            {validPayments.map((inv) => {
              const config = paymentConfigs.get(inv.id);
              const amount = parseFloat(config?.payment_amount || "0");
              const date =
                config?.use_custom && config.custom_date
                  ? config.custom_date
                  : globalDate;
              const method =
                config?.use_custom && config.custom_method
                  ? config.custom_method
                  : globalMethod;
              const reference = config?.use_custom
                ? config.custom_reference
                : globalReference;

              return (
                <div key={inv.id} className="p-4 rounded-lg border bg-card">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{inv.number}</div>
                      <div className="text-sm text-muted-foreground">
                        {inv.customer_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(amount)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        of {formatCurrency(inv.remaining_amount || 0)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                    <span>{format(new Date(date), "MMM d, yyyy")}</span>
                    <span>•</span>
                    <span>{method}</span>
                    {reference && (
                      <>
                        <span>•</span>
                        <span>Ref: {reference}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="flex justify-between items-center">
            <div className="font-medium text-green-600">
              Total to be recorded
            </div>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totals.totalPayment)}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setStep("configure")}>
            Back
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={bulkPayment.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {bulkPayment.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Recording...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirm & Record Payments
              </>
            )}
          </Button>
        </DialogFooter>
      </>
    );
  };

  const renderResultsStep = () => {
    const successResults = results.filter((r) => r.success);
    const failedResults = results.filter((r) => !r.success);

    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {failedResults.length === 0 ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : successResults.length === 0 ? (
              <XCircle className="h-5 w-5 text-destructive" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            )}
            Payment Results
          </DialogTitle>
          <DialogDescription>
            {successResults.length} of {results.length} payment(s) recorded
            successfully.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[350px] pr-4 py-4">
          <div className="space-y-2">
            {results.map((result) => (
              <div
                key={result.invoice_id}
                className={`p-3 rounded-lg border flex items-center justify-between ${
                  result.success
                    ? "bg-green-500/5 border-green-500/20"
                    : "bg-destructive/5 border-destructive/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )}
                  <div>
                    <div className="font-medium">{result.invoice_number}</div>
                    {result.error && (
                      <div className="text-sm text-destructive">
                        {result.error}
                      </div>
                    )}
                  </div>
                </div>
                <Badge variant={result.success ? "default" : "destructive"}>
                  {result.success ? "Recorded" : "Failed"}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={handleClose}>Close</Button>
        </DialogFooter>
      </>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
          {step === "configure" && renderConfigureStep()}
          {step === "review" && renderReviewStep()}
          {step === "results" && renderResultsStep()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Payment Recording</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to record {totals.validCount} payment(s) totaling{" "}
              <span className="font-bold">
                {formatCurrency(totals.totalPayment)}
              </span>
              . This action cannot be undone easily. Are you sure you want to
              proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executePayments}
              className="bg-green-600 hover:bg-green-700"
            >
              Yes, Record Payments
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
