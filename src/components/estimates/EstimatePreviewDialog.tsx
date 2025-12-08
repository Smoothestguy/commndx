import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Eye, X } from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

interface LineItem {
  id: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  margin: number;
  total: number;
  is_taxable?: boolean;
}

interface EstimatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimateNumber?: string;
  customerName: string;
  projectName?: string;
  validUntil: string;
  notes?: string;
  lineItems: LineItem[];
  taxRate: number;
  status?: "draft" | "pending" | "approved" | "sent";
}

export function EstimatePreviewDialog({
  open,
  onOpenChange,
  estimateNumber,
  customerName,
  projectName,
  validUntil,
  notes,
  lineItems,
  taxRate,
  status = "draft",
}: EstimatePreviewDialogProps) {
  const isMobile = useIsMobile();

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxableAmount = lineItems
    .filter((item) => item.is_taxable !== false)
    .reduce((sum, item) => sum + item.total, 0);
  const taxAmount = taxableAmount * (taxRate / 100);
  const total = subtotal + taxAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{estimateNumber || "New Estimate"}</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
              <Eye className="h-3 w-3" />
              Preview
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Estimate Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Estimate Information</CardTitle>
                <StatusBadge status={status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Customer</p>
                  <p className="text-sm">{customerName || "No customer selected"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Project</p>
                  <p className="text-sm">{projectName || "No project"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Valid Until</p>
                  <p className="text-sm">
                    {validUntil ? format(new Date(validUntil), "MMM dd, yyyy") : "Not set"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Created</p>
                  <p className="text-sm">{format(new Date(), "MMM dd, yyyy")}</p>
                </div>
              </div>

              {notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              {lineItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No line items added yet
                </p>
              ) : isMobile ? (
                <div className="space-y-3">
                  {lineItems.map((item) => (
                    <Card key={item.id} className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm">
                          {item.description || "No description"}
                        </span>
                        <span className="text-primary font-semibold ml-2 shrink-0">
                          ${Number(item.total).toFixed(2)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                        <div>
                          <span className="block text-xs mb-0.5">Qty</span>
                          <span>{item.quantity}</span>
                        </div>
                        <div>
                          <span className="block text-xs mb-0.5">Unit Price</span>
                          <span>${Number(item.unit_price).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="block text-xs mb-0.5">Markup</span>
                          <span>{item.margin}%</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Markup</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.description || "No description"}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          ${Number(item.unit_price).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">{item.margin}%</TableCell>
                        <TableCell className="text-right font-medium">
                          ${Number(item.total).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Tax ({taxRate}%)
                    {taxableAmount !== subtotal && (
                      <span className="ml-1 text-xs">
                        (on ${taxableAmount.toFixed(2)})
                      </span>
                    )}
                  </span>
                  <span className="font-medium">${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold pt-2 border-t border-border">
                  <span>Total</span>
                  <span className="text-primary">${total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Close Button */}
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="mr-2 h-4 w-4" />
              Back to Editing
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
