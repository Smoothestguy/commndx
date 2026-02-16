import { useParams } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { SubcontractorPortalLayout } from "@/components/subcontractor-portal/SubcontractorPortalLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useContractorCompletionBill } from "@/integrations/supabase/hooks/useContractorCompletions";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  submitted: { label: "Submitted", variant: "outline", icon: Clock },
  field_verified: { label: "Field Verified", variant: "secondary", icon: CheckCircle2 },
  pm_approved: { label: "PM Approved", variant: "secondary", icon: CheckCircle2 },
  accounting_approved: { label: "Approved for Payment", variant: "default", icon: CheckCircle2 },
  paid: { label: "Paid", variant: "default", icon: CheckCircle2 },
  rejected: { label: "Rejected", variant: "destructive", icon: XCircle },
};

export default function SubcontractorCompletionDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: bill, isLoading } = useContractorCompletionBill(id);

  if (isLoading) {
    return (
      <SubcontractorPortalLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </SubcontractorPortalLayout>
    );
  }

  if (!bill) {
    return (
      <SubcontractorPortalLayout>
        <Card className="p-8 text-center text-muted-foreground">
          Completion bill not found.
        </Card>
      </SubcontractorPortalLayout>
    );
  }

  const config = statusConfig[bill.status] || statusConfig.submitted;
  const StatusIcon = config.icon;

  const timelineSteps = [
    { label: "Submitted", date: bill.submitted_at, done: true },
    { label: "Field Verified", date: bill.verified_at, done: !!bill.verified_at },
    { label: "PM Approved", date: bill.approved_at, done: !!bill.approved_at },
    { label: "Payment Processed", date: bill.accounting_approved_at, done: !!bill.accounting_approved_at },
    { label: "Paid", date: bill.paid_at, done: !!bill.paid_at },
  ];

  return (
    <>
      <SEO title={`Completion - Unit ${bill.room_unit_number}`} />
      <SubcontractorPortalLayout>
        <div className="space-y-6 max-w-3xl">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                Unit {bill.room_unit_number}
              </h1>
              <p className="text-muted-foreground">{bill.project_name}</p>
            </div>
            <Badge variant={config.variant} className="gap-1">
              <StatusIcon className="h-3 w-3" />
              {config.label}
            </Badge>
          </div>

          {bill.status === "rejected" && bill.rejection_notes && (
            <Card className="p-4 border-destructive/50 bg-destructive/5">
              <p className="text-sm font-medium text-destructive">Rejection Reason:</p>
              <p className="text-sm text-foreground mt-1">{bill.rejection_notes}</p>
            </Card>
          )}

          {/* Timeline */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Approval Timeline</h3>
            <div className="space-y-3">
              {timelineSteps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                      step.done
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step.done ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <span className="text-xs">{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <span className={`text-sm ${step.done ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                  </div>
                  {step.date && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(step.date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Line Items */}
          <Card>
            <div className="p-4 border-b">
              <h3 className="font-semibold">Line Items</h3>
            </div>
            <div className="divide-y">
              {bill.items?.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} × {formatCurrency(item.unit_cost)}
                    </p>
                  </div>
                  <span className="font-semibold">{formatCurrency(item.total)}</span>
                </div>
              ))}
            </div>
            <div className="p-4 border-t bg-muted/30 flex justify-between">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-lg">{formatCurrency(bill.total_amount)}</span>
            </div>
          </Card>
        </div>
      </SubcontractorPortalLayout>
    </>
  );
}
