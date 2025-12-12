import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { usePOAddendums, usePOAddendumLineItems, useDeletePOAddendum, useSendChangeOrderForApproval, POAddendum, POAddendumLineItem } from "@/integrations/supabase/hooks/usePOAddendums";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Plus, FileText, Download, Trash2, FileStack, ChevronDown, ChevronRight, Send, CheckCircle, Clock, XCircle, Pencil } from "lucide-react";
import { AddAddendumDialog } from "./AddAddendumDialog";
import { Badge } from "@/components/ui/badge";

function ApprovalStatusBadge({ status }: { status: string | null }) {
  switch (status) {
    case 'approved':
      return <Badge className="bg-success text-success-foreground"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
    case 'pending':
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    case 'rejected':
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
    default:
      return <Badge variant="outline">Draft</Badge>;
  }
}

interface POAddendumsProps {
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  isClosed: boolean;
}

function AddendumLineItems({ addendumId }: { addendumId: string }) {
  const { data: lineItems, isLoading } = usePOAddendumLineItems(addendumId);

  if (isLoading) {
    return <div className="py-2 text-sm text-muted-foreground">Loading line items...</div>;
  }

  if (!lineItems || lineItems.length === 0) {
    return <div className="py-2 text-sm text-muted-foreground">No line items</div>;
  }

  return (
    <div className="mt-2 pl-4 border-l-2 border-border/50">
      <Table>
        <TableHeader>
          <TableRow className="border-border/30">
            <TableHead className="text-xs">Description</TableHead>
            <TableHead className="text-xs text-right">Qty</TableHead>
            <TableHead className="text-xs text-right">Unit Price</TableHead>
            <TableHead className="text-xs text-right">Markup</TableHead>
            <TableHead className="text-xs text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lineItems.map((item) => (
            <TableRow key={item.id} className="border-border/20">
              <TableCell className="text-sm">{item.description}</TableCell>
              <TableCell className="text-sm text-right">{item.quantity}</TableCell>
              <TableCell className="text-sm text-right">${Number(item.unit_price).toFixed(2)}</TableCell>
              <TableCell className="text-sm text-right">{item.markup}%</TableCell>
              <TableCell className="text-sm text-right font-medium">${Number(item.total).toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AddendumRow({ 
  addendum, 
  canManage, 
  onDownload, 
  onDelete,
  onEdit,
  onSendForApproval,
  isSending,
}: { 
  addendum: POAddendum; 
  canManage: boolean; 
  onDownload: (a: POAddendum) => void; 
  onDelete: (a: POAddendum) => void;
  onEdit: (a: POAddendum) => void;
  onSendForApproval: (a: POAddendum) => void;
  isSending: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isApproved = addendum.approval_status === 'approved';

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <TableRow className="border-border/30">
        <TableCell className="w-[35%]">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="p-0 h-auto">
              {isOpen ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
              <span className="font-medium">{addendum.description}</span>
            </Button>
          </CollapsibleTrigger>
        </TableCell>
        <TableCell className="w-[10%]">
          {addendum.number ? (
            <Badge variant="outline" className="font-mono">{addendum.number}</Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell className="w-[15%]">{format(new Date(addendum.created_at), "MMM d, yyyy")}</TableCell>
        <TableCell className="w-[12%]">
          <ApprovalStatusBadge status={addendum.approval_status} />
        </TableCell>
        <TableCell className="w-[13%] text-right">
          ${Number(addendum.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </TableCell>
        <TableCell className="w-[15%] text-right">
          <div className="flex justify-end gap-1">
            {canManage && !isApproved && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(addendum)}
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {addendum.customer_rep_email && addendum.approval_status !== 'approved' && canManage && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onSendForApproval(addendum)}
                disabled={isSending}
                title={addendum.approval_status === 'pending' ? "Resend Approval" : "Send for Approval"}
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
            {addendum.file_path && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDownload(addendum)}
                title="Download"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            {canManage && !isApproved && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(addendum)}
                title="Delete"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      <CollapsibleContent asChild>
        <tr>
          <td colSpan={6} className="p-0">
            <div className="px-4 pb-4">
              <AddendumLineItems addendumId={addendum.id} />
            </div>
          </td>
        </tr>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function POAddendums({ purchaseOrderId, purchaseOrderNumber, isClosed }: POAddendumsProps) {
  const { data: addendums, isLoading } = usePOAddendums(purchaseOrderId);
  const deleteAddendum = useDeletePOAddendum();
  const sendForApproval = useSendChangeOrderForApproval();
  const { isAdmin, isManager } = useUserRole();
  const isMobile = useIsMobile();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<POAddendum | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<POAddendum | null>(null);
  const [editLineItems, setEditLineItems] = useState<POAddendumLineItem[]>([]);

  const handleEdit = async (addendum: POAddendum) => {
    // Fetch line items for the addendum
    const { data: lineItems } = await supabase
      .from("po_addendum_line_items")
      .select("*")
      .eq("po_addendum_id", addendum.id)
      .order("sort_order", { ascending: true });
    
    setEditLineItems((lineItems as POAddendumLineItem[]) || []);
    setEditTarget(addendum);
    setShowAddDialog(true);
  };

  const handleDialogClose = (open: boolean) => {
    setShowAddDialog(open);
    if (!open) {
      setEditTarget(null);
      setEditLineItems([]);
    }
  };

  const handleSendForApproval = async (addendum: POAddendum) => {
    if (!addendum.customer_rep_email) return;
    setSendingId(addendum.id);
    await sendForApproval.mutateAsync(addendum.id);
    setSendingId(null);
  };

  const canManage = (isAdmin || isManager) && !isClosed;

  const handleDownload = async (addendum: POAddendum) => {
    if (!addendum.file_path) return;
    
    const { data, error } = await supabase.storage
      .from("document-attachments")
      .createSignedUrl(addendum.file_path, 60);

    if (error || !data?.signedUrl) {
      console.error("Failed to get download URL:", error);
      return;
    }

    window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteAddendum.mutateAsync({
      id: deleteTarget.id,
      purchaseOrderId,
      filePath: deleteTarget.file_path,
    });
    setDeleteTarget(null);
  };

  const totalAddendums = addendums?.reduce((sum, a) => sum + Number(a.amount), 0) || 0;

  if (isLoading) {
    return (
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileStack className="h-5 w-5 text-primary" />
            Addendums / Change Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileStack className="h-5 w-5 text-primary" />
              Addendums / Change Orders
              {addendums && addendums.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({addendums.length})
                </span>
              )}
            </CardTitle>
            {canManage && (
              <Button size="sm" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Addendum
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!addendums || addendums.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No addendums or change orders</p>
              {canManage && (
                <p className="text-sm mt-1">Click "Add Addendum" to attach a change order</p>
              )}
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {addendums.map((addendum) => (
                <Card key={addendum.id} className="p-4 bg-secondary/30">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-medium">{addendum.description}</span>
                      {addendum.number && (
                        <Badge variant="outline" className="ml-2 font-mono text-xs">
                          {addendum.number}
                        </Badge>
                      )}
                    </div>
                    <span className="text-primary font-semibold">
                      ${Number(addendum.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <span>{format(new Date(addendum.created_at), "MMM d, yyyy")}</span>
                    <div className="flex gap-2">
                      {addendum.file_path && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(addendum)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(addendum)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="w-[35%]">Description</TableHead>
                  <TableHead className="w-[10%]">CO #</TableHead>
                  <TableHead className="w-[15%]">Date</TableHead>
                  <TableHead className="w-[12%]">Status</TableHead>
                  <TableHead className="w-[13%] text-right">Amount</TableHead>
                  <TableHead className="w-[15%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {addendums.map((addendum) => (
                  <AddendumRow
                    key={addendum.id}
                    addendum={addendum}
                    canManage={canManage}
                    onDownload={handleDownload}
                    onDelete={setDeleteTarget}
                    onEdit={handleEdit}
                    onSendForApproval={handleSendForApproval}
                    isSending={sendingId === addendum.id}
                  />
                ))}
              </TableBody>
            </Table>
          )}

          {addendums && addendums.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/30 flex justify-between items-center">
              <span className="font-medium">Total Addendums</span>
              <span className="text-lg font-bold text-primary">
                ${totalAddendums.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <AddAddendumDialog
        open={showAddDialog}
        onOpenChange={handleDialogClose}
        purchaseOrderId={purchaseOrderId}
        purchaseOrderNumber={purchaseOrderNumber}
        editAddendum={editTarget}
        editLineItems={editLineItems}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Addendum</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.description}"? This will reduce the PO total by ${Number(deleteTarget?.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
