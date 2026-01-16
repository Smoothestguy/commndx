import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAddVendorBillPayment } from "@/integrations/supabase/hooks/useVendorBills";
import { useUploadVendorBillPaymentAttachment } from "@/integrations/supabase/hooks/usePaymentAttachments";
import { PaymentFileUpload } from "@/components/payments/PaymentFileUpload";
import { format } from "date-fns";
import { toast } from "sonner";

interface PendingFile {
  id: string;
  file: File;
  name: string;
  size: number;
}

interface VendorBillPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billId: string;
  remainingAmount: number;
}

const paymentMethods = ["Check", "ACH", "Credit Card", "Cash", "Wire", "Other"];

export function VendorBillPaymentDialog({ 
  open, 
  onOpenChange, 
  billId, 
  remainingAmount 
}: VendorBillPaymentDialogProps) {
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [amount, setAmount] = useState(Math.round(remainingAmount * 100) / 100);
  const [paymentMethod, setPaymentMethod] = useState("Check");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const addPayment = useAddVendorBillPayment();
  const uploadAttachment = useUploadVendorBillPaymentAttachment();

  const handleSubmit = async () => {
    if (amount <= 0) {
      toast.error("Payment amount must be greater than zero");
      return;
    }

    if (amount > remainingAmount) {
      toast.error("Payment amount cannot exceed remaining balance");
      return;
    }

    try {
      // Round to 2 decimal places (proper cents) before saving
      const roundedAmount = Math.round(amount * 100) / 100;
      
      const payment = await addPayment.mutateAsync({
        bill_id: billId,
        payment_date: paymentDate,
        amount: roundedAmount,
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

      onOpenChange(false);
      // Reset form
      setAmount(Math.round(remainingAmount * 100) / 100);
      setReferenceNumber("");
      setNotes("");
      setPendingFiles([]);
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Payment Date *</Label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Amount *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                min="0"
                max={remainingAmount}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="pl-7"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Remaining balance: ${(Math.round(remainingAmount * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((method) => (
                  <SelectItem key={method} value={method}>{method}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Reference Number</Label>
            <Input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Check #, Transaction ID, etc."
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
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
          <Button onClick={handleSubmit} disabled={addPayment.isPending || isUploading}>
            {addPayment.isPending || isUploading ? "Recording..." : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
