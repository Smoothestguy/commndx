import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAddInvoicePayment } from "@/integrations/supabase/hooks/useInvoices";
import { useUploadInvoicePaymentAttachment } from "@/integrations/supabase/hooks/usePaymentAttachments";
import { PaymentFileUpload } from "@/components/payments/PaymentFileUpload";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

interface PendingFile {
  id: string;
  file: File;
  name: string;
  size: number;
}

interface InvoicePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  remainingAmount: number;
}

export function InvoicePaymentDialog({ 
  open, 
  onOpenChange, 
  invoiceId, 
  remainingAmount 
}: InvoicePaymentDialogProps) {
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [amount, setAmount] = useState(remainingAmount.toString());
  const [paymentMethod, setPaymentMethod] = useState("Check");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const addPayment = useAddInvoicePayment();
  const uploadAttachment = useUploadInvoicePaymentAttachment();

  const handleSubmit = async () => {
    const paymentAmount = parseFloat(amount);
    
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return;
    }

    if (paymentAmount > remainingAmount) {
      return;
    }

    // Create the payment first
    const payment = await addPayment.mutateAsync({
      invoice_id: invoiceId,
      payment_date: paymentDate,
      amount: paymentAmount,
      payment_method: paymentMethod,
      reference_number: referenceNumber || null,
      notes: notes || null,
    });

    // Upload any pending files
    if (pendingFiles.length > 0 && payment?.id) {
      setIsUploading(true);
      try {
        for (const pendingFile of pendingFiles) {
          await uploadAttachment.mutateAsync({
            paymentId: payment.id,
            file: pendingFile.file,
          });
        }
      } finally {
        setIsUploading(false);
      }
    }

    // Reset form and close
    setAmount(remainingAmount.toString());
    setReferenceNumber("");
    setNotes("");
    setPendingFiles([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment for this invoice. Remaining balance: {formatCurrency(remainingAmount)}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="payment_date">Payment Date</Label>
            <Input
              id="payment_date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="amount">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                max={remainingAmount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7"
              />
            </div>
            {parseFloat(amount) > remainingAmount && (
              <p className="text-sm text-destructive">Amount cannot exceed remaining balance</p>
            )}
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="payment_method">Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Check">Check</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Credit Card">Credit Card</SelectItem>
                <SelectItem value="ACH">ACH</SelectItem>
                <SelectItem value="Wire Transfer">Wire Transfer</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="reference_number">Reference Number</Label>
            <Input
              id="reference_number"
              placeholder="Check #, Confirmation #, etc."
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Optional payment notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <PaymentFileUpload
            pendingFiles={pendingFiles}
            onFilesChange={setPendingFiles}
          />
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={
              addPayment.isPending || 
              isUploading ||
              parseFloat(amount) <= 0 || 
              parseFloat(amount) > remainingAmount
            }
          >
            {addPayment.isPending || isUploading ? "Recording..." : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
