import { useRef } from "react";
import { Trash2, Upload, Paperclip } from "lucide-react";
import { formatLocalDate } from "@/lib/dateUtils";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { InvoicePayment, useDeleteInvoicePayment } from "@/integrations/supabase/hooks/useInvoices";
import {
  useInvoicePaymentAttachments,
  useUploadInvoicePaymentAttachment,
  useDeleteInvoicePaymentAttachment,
} from "@/integrations/supabase/hooks/usePaymentAttachments";
import { PaymentAttachmentsList } from "@/components/payments/PaymentAttachmentsList";

interface InvoicePaymentDetailDialogProps {
  payment: InvoicePayment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
}

export function InvoicePaymentDetailDialog({
  payment,
  open,
  onOpenChange,
  invoiceId,
}: InvoicePaymentDetailDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: attachments = [], isLoading: attachmentsLoading } = useInvoicePaymentAttachments(
    payment?.id
  );
  const uploadAttachment = useUploadInvoicePaymentAttachment();
  const deleteAttachment = useDeleteInvoicePaymentAttachment();
  const deletePayment = useDeleteInvoicePayment();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !payment) return;

    await uploadAttachment.mutateAsync({
      paymentId: payment.id,
      file,
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDeleteAttachment = (attachmentId: string, filePath: string) => {
    if (!payment) return;
    deleteAttachment.mutate({
      attachmentId,
      paymentId: payment.id,
      filePath,
    });
  };

  const handleDeletePayment = () => {
    if (!payment) return;
    deletePayment.mutate({ paymentId: payment.id, invoiceId });
    onOpenChange(false);
  };

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payment Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Payment Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Date</p>
              <p className="font-medium">{formatLocalDate(payment.payment_date)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Amount</p>
              <p className="font-medium text-success">
                {formatCurrency(Number(payment.amount))}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Method</p>
              <p className="font-medium">{payment.payment_method}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Reference #</p>
              <p className="font-medium">{payment.reference_number || "-"}</p>
            </div>
          </div>

          {payment.notes && (
            <div className="text-sm">
              <p className="text-muted-foreground">Notes</p>
              <p className="font-medium">{payment.notes}</p>
            </div>
          )}

          <Separator />

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Attachments</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadAttachment.isPending}
              >
                <Upload className="h-4 w-4 mr-1" />
                Upload
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              />
            </div>

            {attachmentsLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <PaymentAttachmentsList
                attachments={attachments}
                onDelete={handleDeleteAttachment}
                isDeleting={deleteAttachment.isPending}
              />
            )}
          </div>

          <Separator />

          {/* Delete Payment */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Payment
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Payment?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove the payment of {formatCurrency(Number(payment.amount))} from this invoice and update the balance. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeletePayment}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Payment
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DialogContent>
    </Dialog>
  );
}
