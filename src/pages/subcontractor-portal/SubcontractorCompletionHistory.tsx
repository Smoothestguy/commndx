import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { SubcontractorPortalLayout } from "@/components/subcontractor-portal/SubcontractorPortalLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useContractorCompletionBills } from "@/integrations/supabase/hooks/useContractorCompletions";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  submitted: "outline",
  field_verified: "secondary",
  pm_approved: "secondary",
  accounting_approved: "default",
  paid: "default",
  rejected: "destructive",
};

const statusLabel: Record<string, string> = {
  submitted: "Submitted",
  field_verified: "Verified",
  pm_approved: "Approved",
  accounting_approved: "Processing",
  paid: "Paid",
  rejected: "Rejected",
};

export default function SubcontractorCompletionHistory() {
  const navigate = useNavigate();
  const { data: bills, isLoading } = useContractorCompletionBills();

  return (
    <>
      <SEO title="Completion History" />
      <SubcontractorPortalLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Completion History</h1>
            <p className="text-muted-foreground">View all your submitted completions and their status.</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !bills || bills.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              No completions submitted yet.
            </Card>
          ) : (
            <div className="space-y-3">
              {bills.map((bill) => (
                <Card
                  key={bill.id}
                  className="p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => navigate(`/subcontractor/completions/${bill.id}`)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="font-medium text-foreground">
                        Unit {bill.room_unit_number}
                      </span>
                      <span className="text-sm text-muted-foreground ml-2">
                        {bill.project_name}
                      </span>
                    </div>
                    <Badge variant={statusVariant[bill.status] || "outline"}>
                      {statusLabel[bill.status] || bill.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {new Date(bill.submitted_at).toLocaleDateString()}
                    </span>
                    <span className="font-semibold text-primary">
                      {formatCurrency(bill.total_amount)}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </SubcontractorPortalLayout>
    </>
  );
}
