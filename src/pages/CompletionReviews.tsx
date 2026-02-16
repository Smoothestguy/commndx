import { useState } from "react";
import { SEO } from "@/components/SEO";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  useCompletionBillsForReview,
  useUpdateCompletionBillStatus,
} from "@/integrations/supabase/hooks/useContractorCompletions";

export default function CompletionReviews() {
  const [activeTab, setActiveTab] = useState("submitted");
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; billId: string }>({
    open: false,
    billId: "",
  });
  const [rejectNotes, setRejectNotes] = useState("");

  const statusMap: Record<string, string> = {
    submitted: "submitted",
    verified: "field_verified",
    approved: "pm_approved",
  };

  const { data: bills, isLoading } = useCompletionBillsForReview(statusMap[activeTab]);
  const updateStatus = useUpdateCompletionBillStatus();

  const handleAction = (billId: string, action: "verify" | "approve" | "accounting_approve" | "pay") => {
    updateStatus.mutate({ bill_id: billId, action });
  };

  const handleReject = () => {
    updateStatus.mutate(
      { bill_id: rejectDialog.billId, action: "reject", notes: rejectNotes },
      {
        onSuccess: () => {
          setRejectDialog({ open: false, billId: "" });
          setRejectNotes("");
        },
      }
    );
  };

  return (
    <>
      <SEO title="Completion Reviews" description="Review and approve contractor completion bills." />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Completion Reviews</h1>
          <p className="text-muted-foreground">
            Review contractor completion submissions through the approval pipeline.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="submitted">Field Verification</TabsTrigger>
            <TabsTrigger value="verified">PM Approval</TabsTrigger>
            <TabsTrigger value="approved">Accounting</TabsTrigger>
          </TabsList>

          {["submitted", "verified", "approved"].map((tab) => (
            <TabsContent key={tab} value={tab}>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !bills || bills.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">
                  No items pending review.
                </Card>
              ) : (
                <div className="space-y-4">
                  {bills.map((bill: any) => (
                    <Card key={bill.id} className="overflow-hidden">
                      <div className="p-4 border-b bg-muted/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-semibold">
                              Unit {bill.room_unit_number}
                            </span>
                            <span className="text-muted-foreground ml-2">
                              — {bill.project_name}
                            </span>
                          </div>
                          <Badge variant="outline">
                            {formatCurrency(bill.total_amount)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {bill.contractor_name} •{" "}
                          {new Date(bill.submitted_at).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Line items */}
                      <div className="divide-y">
                        {bill.items?.map((item: any) => (
                          <div
                            key={item.id}
                            className="px-4 py-2 flex items-center justify-between text-sm"
                          >
                            <span>{item.description}</span>
                            <span className="text-muted-foreground">
                              {item.quantity} × {formatCurrency(item.unit_cost)} ={" "}
                              <span className="font-medium text-foreground">
                                {formatCurrency(item.total)}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="p-4 border-t flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setRejectDialog({ open: true, billId: bill.id })
                          }
                          disabled={updateStatus.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (tab === "submitted") handleAction(bill.id, "verify");
                            else if (tab === "verified") handleAction(bill.id, "approve");
                            else if (tab === "approved") handleAction(bill.id, "accounting_approve");
                          }}
                          disabled={updateStatus.isPending}
                        >
                          {updateStatus.isPending && (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          )}
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          {tab === "submitted"
                            ? "Verify"
                            : tab === "verified"
                            ? "Approve"
                            : "Process Payment"}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Reject Dialog */}
        <Dialog
          open={rejectDialog.open}
          onOpenChange={(open) => {
            if (!open) setRejectDialog({ open: false, billId: "" });
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Completion</DialogTitle>
            </DialogHeader>
            <Textarea
              placeholder="Reason for rejection..."
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              rows={4}
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRejectDialog({ open: false, billId: "" })}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectNotes.trim() || updateStatus.isPending}
              >
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
