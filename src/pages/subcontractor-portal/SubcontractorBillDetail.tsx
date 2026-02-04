import { SEO } from "@/components/SEO";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubcontractorPortalLayout } from "@/components/subcontractor-portal/SubcontractorPortalLayout";
import { useNavigate, useParams } from "react-router-dom";
import { formatCurrency } from "@/lib/utils";
import { formatLocalDate } from "@/lib/dateUtils";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useSubcontractorBill } from "@/integrations/supabase/hooks/useSubcontractorPortal";

export default function SubcontractorBillDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data: bill, isLoading } = useSubcontractorBill(id);

  if (isLoading) {
    return (
      <SubcontractorPortalLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </SubcontractorPortalLayout>
    );
  }

  if (!bill) {
    return (
      <SubcontractorPortalLayout>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Bill not found.</p>
          <Button
            variant="ghost"
            onClick={() => navigate("/subcontractor/bills")}
            className="mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Bills
          </Button>
        </div>
      </SubcontractorPortalLayout>
    );
  }

  const poInfo = bill.purchase_orders as any;

  return (
    <>
      <SEO title={`Bill ${bill.number}`} description="Bill details" />
      <SubcontractorPortalLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/subcontractor/bills")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{bill.number}</h1>
                <StatusBadge status={bill.status as any} />
              </div>
              <p className="text-muted-foreground">
                PO: {poInfo?.number} • {poInfo?.project_name}
              </p>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Bill Total</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(bill.total || 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Paid Amount</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(bill.paid_amount || 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p
                  className={`text-2xl font-bold ${
                    (bill.remaining_amount || 0) > 0 ? "text-destructive" : ""
                  }`}
                >
                  {formatCurrency(bill.remaining_amount || 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className="text-2xl font-bold">
                  {formatLocalDate(bill.due_date)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Line Items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Line Items</CardTitle>
              </CardHeader>
              <CardContent>
                {bill.vendor_bill_line_items &&
                bill.vendor_bill_line_items.length > 0 ? (
                  <div className="space-y-3">
                    {bill.vendor_bill_line_items.map((item: any) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-start border-b pb-2 last:border-0"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {item.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} × {formatCurrency(item.unit_cost)}
                          </p>
                        </div>
                        <p className="font-medium">
                          {formatCurrency(item.total)}
                        </p>
                      </div>
                    ))}
                    <div className="pt-2 border-t flex justify-between">
                      <span className="font-medium">Total</span>
                      <span className="font-bold">
                        {formatCurrency(bill.total)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No line items.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Payment History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                {bill.vendor_bill_payments &&
                bill.vendor_bill_payments.length > 0 ? (
                  <div className="space-y-3">
                    {bill.vendor_bill_payments.map((payment: any) => (
                      <div
                        key={payment.id}
                        className="flex justify-between items-start border-b pb-2 last:border-0"
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {formatLocalDate(payment.payment_date)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {payment.payment_method}
                            {payment.reference_number &&
                              ` • Ref: ${payment.reference_number}`}
                          </p>
                        </div>
                        <p className="font-medium text-green-600">
                          +{formatCurrency(payment.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No payments recorded yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Notes */}
          {bill.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{bill.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </SubcontractorPortalLayout>
    </>
  );
}
