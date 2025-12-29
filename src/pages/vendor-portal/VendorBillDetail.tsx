import { SEO } from "@/components/SEO";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VendorPortalLayout } from "@/components/vendor-portal/VendorPortalLayout";
import { useParams, useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useVendorBill } from "@/integrations/supabase/hooks/useVendorPortal";
import { format } from "date-fns";
import { formatLocalDate } from "@/lib/dateUtils";

export default function VendorBillDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: bill, isLoading } = useVendorBill(id);

  if (isLoading) {
    return (
      <VendorPortalLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </VendorPortalLayout>
    );
  }

  if (!bill) {
    return (
      <VendorPortalLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Bill Not Found</h2>
          <p className="text-muted-foreground mb-4">
            This bill doesn't exist or you don't have access to view it.
          </p>
          <Button onClick={() => navigate("/vendor/bills")}>
            Back to Bills
          </Button>
        </div>
      </VendorPortalLayout>
    );
  }

  return (
    <>
      <SEO
        title={`Bill ${bill.number}`}
        description={`View details for bill ${bill.number}`}
      />
      <VendorPortalLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/vendor/bills")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{bill.number}</h1>
                <StatusBadge status={bill.status} />
              </div>
              <p className="text-muted-foreground">
                PO: {(bill.purchase_orders as any)?.number} - {(bill.purchase_orders as any)?.project_name}
              </p>
            </div>
          </div>

          {/* Bill Info */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Bill Date</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-medium">
                  {formatLocalDate(bill.bill_date, "MMM d, yyyy")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Due Date</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-medium">
                  {formatLocalDate(bill.due_date, "MMM d, yyyy")}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total Amount</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(bill.total)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Description</th>
                      <th className="text-right py-2 font-medium">Qty</th>
                      <th className="text-right py-2 font-medium">Unit Price</th>
                      <th className="text-right py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.vendor_bill_line_items?.map((item: any) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-2">{item.description}</td>
                        <td className="text-right py-2">{item.quantity}</td>
                        <td className="text-right py-2">{formatCurrency(item.unit_price)}</td>
                        <td className="text-right py-2 font-medium">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td colSpan={3} className="text-right py-2">Total</td>
                      <td className="text-right py-2">{formatCurrency(bill.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {bill.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{bill.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Submission Info */}
          {bill.submitted_at && (
            <Card>
              <CardHeader>
                <CardTitle>Submission Info</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Submitted on {format(new Date(bill.submitted_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </VendorPortalLayout>
    </>
  );
}
