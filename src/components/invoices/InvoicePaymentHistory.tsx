import { Trash2 } from "lucide-react";
import { formatLocalDate } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { useDeleteInvoicePayment, InvoicePayment } from "@/integrations/supabase/hooks/useInvoices";
import { formatCurrency } from "@/lib/utils";
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

interface InvoicePaymentHistoryProps {
  payments: InvoicePayment[];
  invoiceId: string;
}

export function InvoicePaymentHistory({ payments, invoiceId }: InvoicePaymentHistoryProps) {
  const deletePayment = useDeleteInvoicePayment();

  const handleDelete = (paymentId: string) => {
    deletePayment.mutate({ paymentId, invoiceId });
  };

  if (!payments || payments.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No payments recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 font-medium text-muted-foreground">Date</th>
            <th className="text-left py-2 font-medium text-muted-foreground">Method</th>
            <th className="text-left py-2 font-medium text-muted-foreground">Reference</th>
            <th className="text-right py-2 font-medium text-muted-foreground">Amount</th>
            <th className="text-right py-2 font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id} className="border-b border-border/50">
              <td className="py-2">
                {formatLocalDate(payment.payment_date)}
              </td>
              <td className="py-2">{payment.payment_method}</td>
              <td className="py-2 text-muted-foreground">
                {payment.reference_number || "-"}
              </td>
              <td className="py-2 text-right font-medium text-success">
                {formatCurrency(Number(payment.amount))}
              </td>
              <td className="py-2 text-right">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
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
                        onClick={() => handleDelete(payment.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete Payment
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}