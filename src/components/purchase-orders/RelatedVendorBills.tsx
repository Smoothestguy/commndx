import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useVendorBillsByPurchaseOrder, VendorBill } from "@/integrations/supabase/hooks/useVendorBills";
import { formatLocalDate } from "@/lib/dateUtils";
import { Receipt, ExternalLink } from "lucide-react";

interface RelatedVendorBillsProps {
  purchaseOrderId: string;
}

export function RelatedVendorBills({ purchaseOrderId }: RelatedVendorBillsProps) {
  const navigate = useNavigate();
  const { data: bills, isLoading } = useVendorBillsByPurchaseOrder(purchaseOrderId);

  if (isLoading) {
    return (
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Related Vendor Bills
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!bills || bills.length === 0) {
    return (
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Related Vendor Bills
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No vendor bills created from this PO yet.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalBilled = bills.reduce((sum, bill) => sum + Number(bill.total), 0);

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Related Vendor Bills ({bills.length})
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            Total: ${totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead>Bill #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills.map((bill) => (
              <TableRow key={bill.id} className="border-border/30">
                <TableCell className="font-medium">{bill.number}</TableCell>
                <TableCell>{formatLocalDate(bill.bill_date, "MMM d, yyyy")}</TableCell>
                <TableCell>
                  <StatusBadge status={bill.status} />
                </TableCell>
                <TableCell className="text-right">
                  ${Number(bill.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/vendor-bills/${bill.id}`)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
