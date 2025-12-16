import { SEO } from "@/components/SEO";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubcontractorPortalLayout } from "@/components/subcontractor-portal/SubcontractorPortalLayout";
import { POBackChargesDisplay } from "@/components/subcontractor-portal/POBackChargesDisplay";
import { useNavigate, useParams } from "react-router-dom";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import {
  useSubcontractorPurchaseOrder,
  usePOBackCharges,
} from "@/integrations/supabase/hooks/useSubcontractorPortal";

export default function SubcontractorPODetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data: po, isLoading: poLoading } = useSubcontractorPurchaseOrder(id);
  const { data: backCharges, isLoading: backChargesLoading } = usePOBackCharges(id);

  const isLoading = poLoading || backChargesLoading;

  if (isLoading) {
    return (
      <SubcontractorPortalLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </SubcontractorPortalLayout>
    );
  }

  if (!po) {
    return (
      <SubcontractorPortalLayout>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Purchase order not found.</p>
          <Button
            variant="ghost"
            onClick={() => navigate("/subcontractor/purchase-orders")}
            className="mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to POs
          </Button>
        </div>
      </SubcontractorPortalLayout>
    );
  }

  const totalBackCharges = backCharges?.reduce((sum, c) => sum + c.amount, 0) || 0;
  const netRemaining = (po.remaining_to_bill || 0) - totalBackCharges;

  return (
    <>
      <SEO title={`PO ${po.number}`} description="Purchase order details" />
      <SubcontractorPortalLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/subcontractor/purchase-orders")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{po.number}</h1>
                  <StatusBadge status={po.status as any} />
                </div>
                <p className="text-muted-foreground">{po.project_name}</p>
              </div>
            </div>
            <Button
              onClick={() => navigate(`/subcontractor/bills/new?po=${id}`)}
              disabled={netRemaining <= 0}
            >
              <FileText className="h-4 w-4 mr-2" />
              Create Bill
            </Button>
          </div>

          {/* Financial Summary */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Original Total</p>
                <p className="text-2xl font-bold">{formatCurrency(po.total || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Addendums</p>
                <p className="text-2xl font-bold">{formatCurrency(po.total_addendum_amount || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Billed to Date</p>
                <p className="text-2xl font-bold">{formatCurrency(po.billed_to_date || 0)}</p>
              </CardContent>
            </Card>
            <Card className="border-primary">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Net Remaining</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(netRemaining)}</p>
                {totalBackCharges > 0 && (
                  <p className="text-xs text-destructive">-{formatCurrency(totalBackCharges)} back charges</p>
                )}
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
                {po.po_line_items && po.po_line_items.length > 0 ? (
                  <div className="space-y-3">
                    {po.po_line_items.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-start border-b pb-2 last:border-0">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} × {formatCurrency(item.unit_cost)}
                          </p>
                        </div>
                        <p className="font-medium">{formatCurrency(item.total)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No line items.</p>
                )}
              </CardContent>
            </Card>

            {/* Back Charges */}
            <POBackChargesDisplay backCharges={backCharges || []} />
          </div>

          {/* Addendums */}
          {po.po_addendums && po.po_addendums.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Addendums / Change Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {po.po_addendums.map((addendum: any) => (
                    <div key={addendum.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium">{addendum.number || "Addendum"}</p>
                          <p className="text-sm text-muted-foreground">{addendum.description}</p>
                        </div>
                        <p className="font-semibold">{formatCurrency(addendum.amount || 0)}</p>
                      </div>
                      {addendum.po_addendum_line_items && addendum.po_addendum_line_items.length > 0 && (
                        <div className="mt-2 pt-2 border-t space-y-1">
                          {addendum.po_addendum_line_items.map((item: any) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{item.description}</span>
                              <span>{formatCurrency(item.total)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </SubcontractorPortalLayout>
    </>
  );
}
