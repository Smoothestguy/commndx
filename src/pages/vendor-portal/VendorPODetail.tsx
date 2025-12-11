import { SEO } from "@/components/SEO";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VendorPortalLayout } from "@/components/vendor-portal/VendorPortalLayout";
import { useParams, useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { useVendorPurchaseOrder } from "@/integrations/supabase/hooks/useVendorPortal";
import { format } from "date-fns";

export default function VendorPODetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: po, isLoading } = useVendorPurchaseOrder(id);

  if (isLoading) {
    return (
      <VendorPortalLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </VendorPortalLayout>
    );
  }

  if (!po) {
    return (
      <VendorPortalLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Purchase Order Not Found</h2>
          <p className="text-muted-foreground mb-4">
            This purchase order doesn't exist or you don't have access to view it.
          </p>
          <Button onClick={() => navigate("/vendor/pos")}>
            Back to Purchase Orders
          </Button>
        </div>
      </VendorPortalLayout>
    );
  }

  return (
    <>
      <SEO
        title={`PO ${po.number}`}
        description={`View details for purchase order ${po.number}`}
      />
      <VendorPortalLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/vendor/pos")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{po.number}</h1>
                  <StatusBadge status={po.status} />
                </div>
                <p className="text-muted-foreground">{po.project_name}</p>
              </div>
            </div>
            <Button onClick={() => navigate(`/vendor/bills/new?po=${po.id}`)}>
              <FileText className="h-4 w-4 mr-2" />
              Submit Bill
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Original PO</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(po.total)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Change Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(po.total_addendum_amount || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Billed to Date</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(po.billed_to_date)}</p>
              </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Remaining to Bill</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">{formatCurrency(po.remaining_to_bill)}</p>
              </CardContent>
            </Card>
          </div>

          {/* PO Details */}
          <Card>
            <CardHeader>
              <CardTitle>Purchase Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">{po.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-medium">
                    {po.due_date ? format(new Date(po.due_date), "MMM d, yyyy") : "Not set"}
                  </p>
                </div>
                {po.notes && (
                  <div className="sm:col-span-2">
                    <p className="text-sm text-muted-foreground">Notes</p>
                    <p className="font-medium">{po.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

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
                    {po.po_line_items?.map((item: any) => (
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
                      <td colSpan={3} className="text-right py-2">Subtotal</td>
                      <td className="text-right py-2">{formatCurrency(po.subtotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Change Orders / Addendums */}
          {po.po_addendums && po.po_addendums.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Change Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {po.po_addendums.map((addendum: any) => (
                    <div key={addendum.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{addendum.number || 'Addendum'}</p>
                        <p className="text-sm text-muted-foreground">{addendum.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(addendum.amount)}</p>
                        <StatusBadge status={addendum.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </VendorPortalLayout>
    </>
  );
}
