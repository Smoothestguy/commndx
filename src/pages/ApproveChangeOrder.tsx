import { useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  usePOAddendumByToken, 
  usePOAddendumLineItems,
  useApproveChangeOrder,
  useRejectChangeOrder 
} from "@/integrations/supabase/hooks/usePOAddendums";
import { Loader2, CheckCircle, XCircle, FileSignature, AlertTriangle, Pen } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

export default function ApproveChangeOrder() {
  const { token } = useParams<{ token: string }>();
  const [signatureType, setSignatureType] = useState<'type' | 'draw'>('type');
  const [typedSignature, setTypedSignature] = useState("");
  const [approverName, setApproverName] = useState("");
  const [notes, setNotes] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: addendum, isLoading, error } = usePOAddendumByToken(token);
  const { data: lineItems } = usePOAddendumLineItems(addendum?.id || "");
  const approveChangeOrder = useApproveChangeOrder();
  const rejectChangeOrder = useRejectChangeOrder();

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const getSignature = (): string => {
    if (signatureType === 'type') {
      return typedSignature;
    } else {
      const canvas = canvasRef.current;
      if (!canvas) return "";
      return canvas.toDataURL('image/png');
    }
  };

  const handleApprove = async () => {
    const signature = getSignature();
    if (!signature || !approverName.trim()) return;
    if (!token) return;

    await approveChangeOrder.mutateAsync({
      token,
      signature,
      approvedByName: approverName.trim(),
      notes: notes.trim() || undefined,
    });
  };

  const handleReject = async () => {
    if (!token) return;
    
    await rejectChangeOrder.mutateAsync({
      token,
      notes: notes.trim() || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading change order...</p>
        </div>
      </div>
    );
  }

  if (error || !addendum) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Change Order Not Found</h2>
            <p className="text-muted-foreground">
              This approval link may be invalid or expired. Please contact your vendor for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if already processed
  if (addendum.approval_status === 'approved') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-success mb-4" />
            <h2 className="text-xl font-semibold mb-2">Already Approved</h2>
            <p className="text-muted-foreground mb-4">
              This change order was approved on {format(new Date(addendum.approved_at!), 'PPP')} by {addendum.approved_by_name}.
            </p>
            <Badge variant="default" className="bg-success">Approved</Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (addendum.approval_status === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Change Order Rejected</h2>
            <p className="text-muted-foreground mb-4">
              This change order has been rejected.
            </p>
            <Badge variant="destructive">Rejected</Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  const poNumber = (addendum as any).purchase_orders?.number || 'N/A';
  const vendorName = (addendum as any).purchase_orders?.vendors?.name || 'N/A';

  const isSignatureValid = signatureType === 'type' 
    ? typedSignature.trim().length > 0 
    : canvasRef.current?.toDataURL() !== canvasRef.current?.getContext('2d')?.canvas.toDataURL();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <FileSignature className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Change Order Approval</h1>
          <p className="text-muted-foreground mt-2">
            Review and approve change order {addendum.number}
          </p>
        </div>

        {/* Change Order Details */}
        <Card>
          <CardHeader>
            <CardTitle>Change Order Details</CardTitle>
            <CardDescription>Review the details below before approving</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Change Order #:</span>
                <p className="font-semibold">{addendum.number}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Purchase Order:</span>
                <p className="font-semibold">{poNumber}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Vendor:</span>
                <p className="font-semibold">{vendorName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Date:</span>
                <p className="font-semibold">{format(new Date(addendum.created_at), 'PPP')}</p>
              </div>
            </div>

            <Separator />

            <div>
              <span className="text-muted-foreground text-sm">Description / Reason:</span>
              <p className="mt-1">{addendum.description}</p>
            </div>

            <Separator />

            {/* Line Items */}
            <div>
              <h4 className="font-semibold mb-3">Line Items</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Description</th>
                      <th className="px-4 py-2 text-right font-medium">Qty</th>
                      <th className="px-4 py-2 text-right font-medium">Unit Price</th>
                      <th className="px-4 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems?.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-4 py-2">{item.description}</td>
                        <td className="px-4 py-2 text-right">{item.quantity}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(item.unit_price)}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-secondary/30">
                    <tr className="border-t">
                      <td colSpan={3} className="px-4 py-2 text-right font-medium">Subtotal:</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(addendum.subtotal)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-right font-bold text-lg">Total:</td>
                      <td className="px-4 py-2 text-right font-bold text-lg text-primary">
                        {formatCurrency(addendum.amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Signature Section */}
        {!rejectMode && (
          <Card>
            <CardHeader>
              <CardTitle>Electronic Signature</CardTitle>
              <CardDescription>
                By signing below, you agree to the terms of this change order
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Your Name *</Label>
                <Input
                  placeholder="Enter your full name"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Signature Method</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={signatureType === 'type' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSignatureType('type')}
                  >
                    Type Signature
                  </Button>
                  <Button
                    type="button"
                    variant={signatureType === 'draw' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSignatureType('draw')}
                  >
                    <Pen className="h-4 w-4 mr-1" />
                    Draw Signature
                  </Button>
                </div>
              </div>

              {signatureType === 'type' ? (
                <div className="space-y-2">
                  <Label>Type Your Signature *</Label>
                  <Input
                    placeholder="Type your full name as signature"
                    value={typedSignature}
                    onChange={(e) => setTypedSignature(e.target.value)}
                    className="font-signature text-xl italic"
                    style={{ fontFamily: "'Brush Script MT', cursive" }}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Draw Your Signature *</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={clearSignature}>
                      Clear
                    </Button>
                  </div>
                  <div className="border-2 border-dashed border-border rounded-lg bg-white">
                    <canvas
                      ref={canvasRef}
                      width={400}
                      height={150}
                      className="w-full cursor-crosshair touch-none"
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use your mouse or finger to draw your signature
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  placeholder="Add any notes or comments..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  onClick={handleApprove}
                  disabled={!isSignatureValid || !approverName.trim() || approveChangeOrder.isPending}
                  className="flex-1"
                >
                  {approveChangeOrder.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve & Sign
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setRejectMode(true)}
                  className="flex-1"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reject Section */}
        {rejectMode && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Reject Change Order</CardTitle>
              <CardDescription>
                Please provide a reason for rejecting this change order
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Rejection Reason</Label>
                <Textarea
                  placeholder="Enter the reason for rejection..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setRejectMode(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={rejectChangeOrder.isPending}
                  className="flex-1"
                >
                  {rejectChangeOrder.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm Rejection
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Legal Disclaimer */}
        <p className="text-center text-xs text-muted-foreground px-4">
          By approving this change order, you acknowledge that you have reviewed the details 
          and agree to the changes outlined above. This electronic signature is legally binding.
        </p>
      </div>
    </div>
  );
}