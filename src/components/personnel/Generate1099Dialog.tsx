import { useState, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { W9Form } from "@/integrations/supabase/hooks/useW9Forms";
import { supabase } from "@/integrations/supabase/client";
import { downloadForm1099, Generate1099Options } from "@/lib/generate1099";
import { FileText, Download, AlertCircle, DollarSign, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Generate1099DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personnelId: string;
  personnelName: string;
  w9Form: W9Form | null;
  personnelData: {
    first_name: string;
    last_name: string;
    ssn_full?: string | null;
    ssn_last_four?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  };
}

interface PaymentSummary {
  totalPayments: number;
  timeEntriesTotal: number;
  reimbursementsTotal: number;
}

export function Generate1099Dialog({
  open,
  onOpenChange,
  personnelId,
  personnelName,
  w9Form,
  personnelData,
}: Generate1099DialogProps) {
  const currentYear = new Date().getFullYear();
  const [taxYear, setTaxYear] = useState(currentYear - 1);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);

  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Fetch company info and payment data when dialog opens
  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, taxYear, personnelId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch company settings
      const { data: company } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .single();
      
      setCompanyInfo(company);

      // Calculate payments for the tax year
      const startDate = `${taxYear}-01-01`;
      const endDate = `${taxYear}-12-31`;

      // Fetch time entries for this personnel
      const { data: timeEntries } = await supabase
        .from("time_entries")
        .select("hours, regular_hours, overtime_hours")
        .eq("personnel_id", personnelId)
        .gte("entry_date", startDate)
        .lte("entry_date", endDate);

      // Fetch personnel payments
      const { data: personnelPayments } = await supabase
        .from("personnel_payments")
        .select("gross_amount")
        .eq("personnel_id", personnelId)
        .gte("payment_date", startDate)
        .lte("payment_date", endDate);

      const timeEntriesHours = timeEntries?.reduce((sum, entry) => sum + (entry.hours || 0), 0) || 0;
      const paymentsTotal = personnelPayments?.reduce((sum, payment) => sum + (payment.gross_amount || 0), 0) || 0;

      setPaymentSummary({
        totalPayments: paymentsTotal,
        timeEntriesTotal: timeEntriesHours,
        reimbursementsTotal: 0,
      });
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!w9Form || !companyInfo || !paymentSummary) return;

    setIsGenerating(true);
    try {
      const options: Generate1099Options = {
        taxYear,
        w9Form,
        personnel: personnelData,
        company: companyInfo,
        payments: {
          totalNonemployeeCompensation: paymentSummary.totalPayments,
          federalTaxWithheld: 0,
          stateTaxWithheld: 0,
          stateIncome: paymentSummary.totalPayments,
        },
      };

      await downloadForm1099(options);
      toast.success("1099-NEC downloaded successfully");
    } catch (error) {
      console.error("Error generating 1099:", error);
      toast.error("Failed to generate 1099-NEC. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate 1099-NEC
          </DialogTitle>
          <DialogDescription>
            Generate a 1099-NEC form for {personnelName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* W-9 Status Check */}
          {!w9Form ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>W-9 Required</AlertTitle>
              <AlertDescription>
                This personnel member has not submitted a W-9 form. A completed W-9 is required before generating a 1099.
              </AlertDescription>
            </Alert>
          ) : w9Form.status !== "verified" ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>W-9 Not Verified</AlertTitle>
              <AlertDescription>
                The W-9 form has not been verified yet. You can still generate a 1099, but please verify the information is correct.
              </AlertDescription>
            </Alert>
          ) : null}

          {/* Tax Year Selection */}
          <div className="space-y-2">
            <Label>Tax Year</Label>
            <Select
              value={taxYear.toString()}
              onValueChange={(value) => setTaxYear(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Summary */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : paymentSummary && (
            <Card>
              <CardContent className="pt-4">
                <h4 className="font-semibold flex items-center gap-2 mb-3">
                  <DollarSign className="h-4 w-4" />
                  {taxYear} Payment Summary
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time Entry Compensation:</span>
                    <span className="font-medium">{formatCurrency(paymentSummary.timeEntriesTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reimbursements (non-taxable):</span>
                    <span className="font-medium">{formatCurrency(paymentSummary.reimbursementsTotal)}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-semibold">
                    <span>Total Nonemployee Compensation:</span>
                    <span>{formatCurrency(paymentSummary.totalPayments)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recipient Info Preview */}
          {w9Form && (
            <Card>
              <CardContent className="pt-4">
                <h4 className="font-semibold mb-3">Recipient Information</h4>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{w9Form.name_on_return}</p>
                  <p className="text-muted-foreground">{w9Form.address}</p>
                  <p className="text-muted-foreground">{w9Form.city}, {w9Form.state} {w9Form.zip}</p>
                  <p className="text-muted-foreground">TIN: ***-**-{personnelData.ssn_last_four || "XXXX"}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleGenerate}
            disabled={!w9Form || isLoading || isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isGenerating ? "Generating..." : "Download 1099-NEC"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
