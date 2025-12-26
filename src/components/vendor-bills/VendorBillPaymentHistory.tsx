import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatLocalDate } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { VendorBillPayment, useDeleteVendorBillPayment } from "@/integrations/supabase/hooks/useVendorBills";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface VendorBillPaymentHistoryProps {
  payments: VendorBillPayment[];
  billId: string;
}

export function VendorBillPaymentHistory({ payments, billId }: VendorBillPaymentHistoryProps) {
  const deletePayment = useDeleteVendorBillPayment();

  if (!payments || payments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No payments recorded yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Method</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell>{formatLocalDate(payment.payment_date)}</TableCell>
            <TableCell>{payment.payment_method}</TableCell>
            <TableCell>{payment.reference_number || "-"}</TableCell>
            <TableCell className="font-medium">
              ${Number(payment.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </TableCell>
            <TableCell>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Payment</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this payment? This will update the bill balance.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deletePayment.mutate({ id: payment.id, billId })}
                      className="bg-destructive text-destructive-foreground"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
