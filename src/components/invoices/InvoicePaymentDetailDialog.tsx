import { useRef, useState, useEffect } from "react";
import { Trash2, Upload, Paperclip, Pencil, X, Check } from "lucide-react";
import { formatLocalDate } from "@/lib/dateUtils";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { InvoicePayment, useDeleteInvoicePayment, useUpdateInvoicePayment } from "@/integrations/supabase/hooks/useInvoices";
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

const PAYMENT_METHODS = ["Check", "Cash", "Credit Card", "ACH", "Wire Transfer", "Other"];

export function InvoicePaymentDetailDialog({
  payment,
  open,
  onOpenChange,
  invoiceId,
}: InvoicePaymentDetailDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    payment_date: "",
    amount: "",
    payment_method: "",
    reference_number: "",
    notes: "",
  });

  const { data: attachments = [], isLoading: attachmentsLoading } = useInvoicePaymentAttachments(
    payment?.id
  );
  const uploadAttachment = useUploadInvoicePaymentAttachment();
  const deleteAttachment = useDeleteInvoicePaymentAttachment();
  const deletePayment = useDeleteInvoicePayment();
  const updatePayment = useUpdateInvoicePayment();

  // Reset form when payment changes or dialog opens
  useEffect(() => {
    if (payment && open) {
      setEditForm({
        payment_date: payment.payment_date,
        amount: String(payment.amount),
        payment_method: payment.payment_method,
        reference_number: payment.reference_number || "",
        notes: payment.notes || "",
      });
      setIsEditing(false);
    }
  }, [payment, open]);

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

  const handleSaveEdit = async () => {
    if (!payment) return;

    await updatePayment.mutateAsync({
      paymentId: payment.id,
      invoiceId,
      updates: {
        payment_date: editForm.payment_date,
        amount: parseFloat(editForm.amount),
        payment_method: editForm.payment_method,
        reference_number: editForm.reference_number || null,
        notes: editForm.notes || null,
      },
    });

    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    if (payment) {
      setEditForm({
        payment_date: payment.payment_date,
        amount: String(payment.amount),
        payment_method: payment.payment_method,
        reference_number: payment.reference_number || "",
        notes: payment.notes || "",
      });
    }
    setIsEditing(false);
  };

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Payment Details</DialogTitle>
            {!isEditing ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="h-8 w-8 p-0"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={updatePayment.isPending}
                  className="h-8 w-8 p-0 text-success"
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Payment Info */}
          {isEditing ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Date</label>
                <Input
                  type="date"
                  value={editForm.payment_date}
                  onChange={(e) => setEditForm({ ...editForm, payment_date: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Amount</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Method</label>
                <Select
                  value={editForm.payment_method}
                  onValueChange={(value) => setEditForm({ ...editForm, payment_method: value })}
                >
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
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Reference #</label>
                <Input
                  value={editForm.reference_number}
                  onChange={(e) => setEditForm({ ...editForm, reference_number: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-sm text-muted-foreground">Notes</label>
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Optional notes..."
                  rows={2}
                />
              </div>
            </div>
          ) : (
            <>
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
            </>
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
