import { useState } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel, usePersonnelReimbursements, usePersonnelAssignments, useAddReimbursement } from "@/integrations/supabase/hooks/usePortal";
import { useExpenseCategories } from "@/integrations/supabase/hooks/useExpenseCategories";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, Plus, DollarSign, Image, Download, Eye } from "lucide-react";
import { downloadReceipt, getReceiptFilename } from "@/utils/receiptDownload";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ReceiptUpload } from "@/components/portal/ReceiptUpload";

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  paid: "outline",
};

export default function PortalReimbursements() {
  const { data: personnel } = useCurrentPersonnel();
  const { data: reimbursements, isLoading } = usePersonnelReimbursements(personnel?.id);
  const { data: assignments } = usePersonnelAssignments(personnel?.id);
  const { data: expenseCategories, isLoading: categoriesLoading } = useExpenseCategories('both');
  const addReimbursement = useAddReimbursement();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    category: "",
    category_id: "",
    project_id: "",
    receipt_url: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personnel?.id) return;

    await addReimbursement.mutateAsync({
      personnel_id: personnel.id,
      amount: parseFloat(formData.amount),
      description: formData.description,
      category: formData.category,
      project_id: formData.project_id || null,
      status: "pending",
      receipt_url: formData.receipt_url || null,
      notes: null,
    });

    setFormData({ amount: "", description: "", category: "", category_id: "", project_id: "", receipt_url: "" });
    setDialogOpen(false);
  };

  // Calculate totals
  const pendingTotal = reimbursements?.filter(r => r.status === "pending").reduce((sum, r) => sum + r.amount, 0) || 0;
  const approvedTotal = reimbursements?.filter(r => r.status === "approved").reduce((sum, r) => sum + r.amount, 0) || 0;

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Reimbursements</h1>
            <p className="text-muted-foreground">Submit and track expense reimbursements</p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Reimbursement
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Submit Reimbursement</DialogTitle>
                <DialogDescription>
                  Submit an expense for reimbursement approval
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="pl-9"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => {
                      const selectedCategory = expenseCategories?.find(c => c.id === value);
                      setFormData({ 
                        ...formData, 
                        category_id: value,
                        category: selectedCategory?.name || ""
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriesLoading ? (
                        <SelectItem value="loading" disabled>Loading categories...</SelectItem>
                      ) : expenseCategories && expenseCategories.length > 0 ? (
                        expenseCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="other">Other</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="project">Project (Optional)</Label>
                  <Select
                    value={formData.project_id || "none"}
                    onValueChange={(value) => setFormData({ ...formData, project_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific project</SelectItem>
                      {assignments?.filter(a => a.project?.id).map((assignment) => (
                        <SelectItem key={assignment.project!.id} value={assignment.project!.id}>
                          {assignment.project?.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the expense..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>

                {personnel?.id && (
                  <div className="space-y-2">
                    <Label>Receipt (Optional)</Label>
                    <ReceiptUpload
                      personnelId={personnel.id}
                      onUpload={(url) => setFormData({ ...formData, receipt_url: url })}
                      existingUrl={formData.receipt_url || null}
                    />
                  </div>
                )}
                
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addReimbursement.isPending}>
                    {addReimbursement.isPending ? "Submitting..." : "Submit"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Approval
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${pendingTotal.toFixed(2)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Approved (Awaiting Payment)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${approvedTotal.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Reimbursements List */}
        {reimbursements && reimbursements.length > 0 ? (
          <div className="space-y-4">
            {reimbursements.map((reimbursement) => (
              <Card key={reimbursement.id}>
                <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      {reimbursement.receipt_url ? (
                        <div className="flex-shrink-0">
                          <button
                            onClick={() => setPreviewUrl(reimbursement.receipt_url)}
                            className="block"
                          >
                            <div className="w-12 h-12 rounded-lg overflow-hidden border bg-muted hover:opacity-80 transition-opacity">
                              {reimbursement.receipt_url.endsWith('.pdf') ? (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Image className="h-5 w-5 text-muted-foreground" />
                                </div>
                              ) : (
                                <img
                                  src={reimbursement.receipt_url}
                                  alt="Receipt"
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                          </button>
                          <div className="flex gap-1 mt-1 justify-center">
                            <button
                              onClick={() => setPreviewUrl(reimbursement.receipt_url)}
                              className="text-xs text-primary hover:underline"
                              title="Preview"
                            >
                              <Eye className="h-3 w-3" />
                            </button>
                            <button
                              onClick={async () => {
                                const filename = getReceiptFilename(
                                  reimbursement.description,
                                  reimbursement.submitted_at,
                                  reimbursement.receipt_url!
                                );
                                const result = await downloadReceipt(reimbursement.receipt_url!, filename);
                                if (!result.success) {
                                  toast.error(result.error || "Receipt file unavailable");
                                }
                              }}
                              className="text-xs text-muted-foreground hover:text-foreground"
                              title="Download"
                            >
                              <Download className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg bg-muted flex-shrink-0">
                          <Receipt className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{reimbursement.description}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 flex-wrap">
                          <span className="capitalize">{reimbursement.category}</span>
                          {reimbursement.project && (
                            <>
                              <span>•</span>
                              <span>{reimbursement.project.name}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{format(parseISO(reimbursement.submitted_at), "MMM d, yyyy")}</span>
                        </div>
                        {reimbursement.notes && (
                          <p className="text-sm text-muted-foreground mt-2 italic">
                            Note: {reimbursement.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-semibold">${reimbursement.amount.toFixed(2)}</p>
                      <Badge variant={STATUS_COLORS[reimbursement.status]} className="mt-1">
                        {reimbursement.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No reimbursements</h3>
              <p className="text-muted-foreground text-center mb-4">
                You haven't submitted any reimbursement requests yet.
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Submit First Reimbursement
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Receipt Preview Dialog */}
        <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Receipt Preview</DialogTitle>
            </DialogHeader>
            {previewUrl && (
              <div className="flex items-center justify-center max-h-[70vh] overflow-auto">
                {previewUrl.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[70vh] border-0"
                    title="Receipt PDF"
                  />
                ) : (
                  <img src={previewUrl} alt="Receipt" className="max-w-full h-auto" />
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PortalLayout>
  );
}
