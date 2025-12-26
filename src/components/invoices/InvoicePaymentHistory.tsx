import { useState } from "react";
import { ChevronRight, Paperclip } from "lucide-react";
import { formatLocalDate } from "@/lib/dateUtils";
import { InvoicePayment } from "@/integrations/supabase/hooks/useInvoices";
import { useInvoicePaymentAttachments } from "@/integrations/supabase/hooks/usePaymentAttachments";
import { formatCurrency } from "@/lib/utils";
import { InvoicePaymentDetailDialog } from "./InvoicePaymentDetailDialog";

interface InvoicePaymentHistoryProps {
  payments: InvoicePayment[];
  invoiceId: string;
}

function PaymentRow({ 
  payment, 
  onClick 
}: { 
  payment: InvoicePayment; 
  onClick: () => void;
}) {
  const { data: attachments = [] } = useInvoicePaymentAttachments(payment.id);
  const hasAttachments = attachments.length > 0;

  return (
    <tr 
      className="border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
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
        <div className="flex items-center justify-end gap-1">
          {hasAttachments && (
            <Paperclip className="h-4 w-4 text-muted-foreground" />
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </td>
    </tr>
  );
}

export function InvoicePaymentHistory({ payments, invoiceId }: InvoicePaymentHistoryProps) {
  const [selectedPayment, setSelectedPayment] = useState<InvoicePayment | null>(null);

  if (!payments || payments.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No payments recorded yet.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 font-medium text-muted-foreground">Date</th>
              <th className="text-left py-2 font-medium text-muted-foreground">Method</th>
              <th className="text-left py-2 font-medium text-muted-foreground">Reference</th>
              <th className="text-right py-2 font-medium text-muted-foreground">Amount</th>
              <th className="text-right py-2 font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <PaymentRow 
                key={payment.id} 
                payment={payment} 
                onClick={() => setSelectedPayment(payment)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <InvoicePaymentDetailDialog
        payment={selectedPayment}
        open={!!selectedPayment}
        onOpenChange={(open) => !open && setSelectedPayment(null)}
        invoiceId={invoiceId}
      />
    </>
  );
}