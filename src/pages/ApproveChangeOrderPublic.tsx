import { useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, FileSignature, AlertTriangle, Pen } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function useChangeOrderByToken(token: string | undefined) {
  return useQuery({
    queryKey: ["co_approval", token],
    queryFn: async () => {
      if (!token) return null;
      // Try field supervisor token first
      let { data, error } = await supabase
        .from("change_orders")
        .select("*, project:projects(id, name), line_items:change_order_line_items(*)")
        .eq("field_supervisor_approval_token", token)
        .maybeSingle();

      if (!data) {
        // Try customer PM token
        const result = await supabase
          .from("change_orders")
          .select("*, project:projects(id, name), line_items:change_order_line_items(*)")
          .eq("customer_pm_approval_token", token)
          .maybeSingle();
        data = result.data;
        error = result.error;
      }

      if (error) throw error;
      return data as any;
    },
    enabled: !!token,
  });
}

export default function ApproveChangeOrderPublic() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [signatureType, setSignatureType] = useState<"type" | "draw">("type");
  const [typedSignature, setTypedSignature] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: co, isLoading, error } = useChangeOrderByToken(token);

  const processSignature = useMutation({
    mutationFn: async (payload: {
      token: string;
      signature?: string;
      signer_name: string;
      signer_email: string;
      action: "approve" | "reject";
      notes?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("process-co-signature", {
        body: payload,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["co_approval", token] });
      if (data.action === "rejected") {
        toast.success("Change order rejected");
      } else {
        toast.success("Change order signed successfully!");
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  };

  const handleMouseUp = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const getSignature = (): string => {
    if (signatureType === "type") return typedSignature;
    const canvas = canvasRef.current;
    if (!canvas) return "";
    return canvas.toDataURL("image/png");
  };

  const handleApprove = async () => {
    const signature = getSignature();
    if (!signature || !signerName.trim() || !token) return;
    await processSignature.mutateAsync({
      token,
      signature,
      signer_name: signerName.trim(),
      signer_email: signerEmail.trim(),
      action: "approve",
      notes: notes.trim() || undefined,
    });
  };

  const handleReject = async () => {
    if (!token) return;
    await processSignature.mutateAsync({
      token,
      signer_name: signerName.trim() || "Unknown",
      signer_email: signerEmail.trim(),
      action: "reject",
      notes: notes.trim() || "Rejected without reason",
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

  if (error || !co) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Change Order Not Found</h2>
            <p className="text-muted-foreground">This approval link may be invalid or expired.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isFieldSupervisor = co.field_supervisor_approval_token === token;
  const isCustomerPM = co.customer_pm_approval_token === token;
  const signerRole = isFieldSupervisor ? "Field Supervisor" : "Customer PM";

  // Check if already signed
  if (isFieldSupervisor && co.field_supervisor_signed_at) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Already Signed</h2>
            <p className="text-muted-foreground">This change order was signed on {format(new Date(co.field_supervisor_signed_at), "PPP")}.</p>
            <Badge variant="default" className="mt-4">Signed</Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isCustomerPM && co.customer_pm_signed_at) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Already Signed</h2>
            <p className="text-muted-foreground">This change order was signed on {format(new Date(co.customer_pm_signed_at), "PPP")}.</p>
            <Badge variant="default" className="mt-4">Signed</Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (co.status === "rejected") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Change Order Rejected</h2>
            <Badge variant="destructive">Rejected</Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check wrong stage
  if (isFieldSupervisor && co.status !== "pending_field_supervisor") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Not Ready for Your Approval</h2>
            <p className="text-muted-foreground">This change order is not currently awaiting field supervisor approval.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isCustomerPM && co.status !== "pending_customer_pm") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Not Ready for Your Approval</h2>
            <p className="text-muted-foreground">This change order is not currently awaiting your approval. It may still need the field supervisor's signature first.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (processSignature.isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {processSignature.data?.action === "rejected" ? "Change Order Rejected" : "Signed Successfully!"}
            </h2>
            <p className="text-muted-foreground">
              {processSignature.data?.action === "rejected"
                ? "The change order has been rejected."
                : "Thank you for your approval. The next step in the approval process has been initiated."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const lineItems = co.line_items || [];
  const project = co.project as any;
  const isSignatureValid = signatureType === "type" ? typedSignature.trim().length > 0 : true;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <FileSignature className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Change Order Approval</h1>
          <p className="text-muted-foreground mt-2">
            {signerRole} — Review and sign CO {co.number}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Change Order Details</CardTitle>
            <CardDescription>Review the details below before signing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">CO Number:</span>
                <p className="font-semibold">{co.number}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Project:</span>
                <p className="font-semibold">{project?.name || "N/A"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span>
                <p className="font-semibold">{co.change_type === "deductive" ? "Deductive (Credit)" : "Additive"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Date:</span>
                <p className="font-semibold">{format(new Date(co.created_at), "PPP")}</p>
              </div>
            </div>

            <Separator />

            <div>
              <span className="text-muted-foreground text-sm">Reason:</span>
              <p className="mt-1">{co.reason}</p>
            </div>
            {co.description && (
              <div>
                <span className="text-muted-foreground text-sm">Description:</span>
                <p className="mt-1">{co.description}</p>
              </div>
            )}

            {/* Photos */}
            {co.photos && co.photos.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="font-semibold mb-3">Photos ({co.photos.length})</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {co.photos.map((photo: string, i: number) => {
                      const { data: urlData } = supabase.storage.from("form-uploads").getPublicUrl(photo);
                      return (
                        <img
                          key={i}
                          src={urlData.publicUrl}
                          alt={`Photo ${i + 1}`}
                          className="rounded-lg border object-cover w-full h-32"
                        />
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div>
              <h4 className="font-semibold mb-3">Line Items</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Description</th>
                      <th className="px-4 py-2 text-right font-medium">Qty</th>
                      <th className="px-4 py-2 text-right font-medium">Price</th>
                      <th className="px-4 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item: any) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-4 py-2">{item.description}</td>
                        <td className="px-4 py-2 text-right">{item.quantity}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(item.unit_price)}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-secondary/30">
                    <tr className="border-t font-bold">
                      <td colSpan={3} className="px-4 py-2 text-right">Total:</td>
                      <td className="px-4 py-2 text-right text-lg text-primary">{formatCurrency(co.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Show field supervisor signature if we're the PM */}
            {isCustomerPM && co.field_supervisor_signed_at && (
              <>
                <Separator />
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-3 rounded-lg">
                  <CheckCircle className="h-4 w-4" />
                  <span>Field Supervisor signed on {format(new Date(co.field_supervisor_signed_at), "PPP")}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Signature Section */}
        {!rejectMode && (
          <Card>
            <CardHeader>
              <CardTitle>Electronic Signature</CardTitle>
              <CardDescription>By signing below, you approve this change order</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Your Name *</Label>
                  <Input placeholder="Full name" value={signerName} onChange={(e) => setSignerName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Your Email</Label>
                  <Input placeholder="Email" type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Signature Method</Label>
                <div className="flex gap-2">
                  <Button type="button" variant={signatureType === "type" ? "default" : "outline"} size="sm" onClick={() => setSignatureType("type")}>
                    Type Signature
                  </Button>
                  <Button type="button" variant={signatureType === "draw" ? "default" : "outline"} size="sm" onClick={() => setSignatureType("draw")}>
                    <Pen className="h-4 w-4 mr-1" /> Draw
                  </Button>
                </div>
              </div>

              {signatureType === "type" ? (
                <div className="space-y-2">
                  <Label>Type Your Signature *</Label>
                  <Input
                    placeholder="Type your full name"
                    value={typedSignature}
                    onChange={(e) => setTypedSignature(e.target.value)}
                    className="text-xl italic"
                    style={{ fontFamily: "'Brush Script MT', cursive" }}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Draw Your Signature *</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={clearSignature}>Clear</Button>
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
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea placeholder="Add any notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button onClick={handleApprove} disabled={!isSignatureValid || !signerName.trim() || processSignature.isPending} className="flex-1">
                  {processSignature.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <CheckCircle className="mr-2 h-4 w-4" /> Approve & Sign
                </Button>
                <Button variant="destructive" onClick={() => setRejectMode(true)} className="flex-1">
                  <XCircle className="mr-2 h-4 w-4" /> Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {rejectMode && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Reject Change Order</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Rejection Reason</Label>
                <Textarea placeholder="Enter the reason..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setRejectMode(false)} className="flex-1">Cancel</Button>
                <Button variant="destructive" onClick={handleReject} disabled={processSignature.isPending} className="flex-1">
                  {processSignature.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm Rejection
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground px-4">
          By approving this change order, you acknowledge that you have reviewed the details and agree to the changes outlined above. This electronic signature is legally binding.
        </p>
      </div>
    </div>
  );
}
