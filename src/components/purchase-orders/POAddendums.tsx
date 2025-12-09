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
import { usePOAddendums, useDeletePOAddendum, POAddendum } from "@/integrations/supabase/hooks/usePOAddendums";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Plus, FileText, Download, Trash2, FileStack } from "lucide-react";
import { AddAddendumDialog } from "./AddAddendumDialog";

interface POAddendumsProps {
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  isClosed: boolean;
}

export function POAddendums({ purchaseOrderId, purchaseOrderNumber, isClosed }: POAddendumsProps) {
  const { data: addendums, isLoading } = usePOAddendums(purchaseOrderId);
  const deleteAddendum = useDeletePOAddendum();
  const { isAdmin, isManager } = useUserRole();
  const isMobile = useIsMobile();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<POAddendum | null>(null);

  const canManage = (isAdmin || isManager) && !isClosed;

  const handleDownload = async (addendum: POAddendum) => {
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
                    <span className="font-medium">{addendum.description}</span>
                    <span className="text-primary font-semibold">
                      ${Number(addendum.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <span>{format(new Date(addendum.created_at), "MMM d, yyyy")}</span>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(addendum)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
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
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {addendums.map((addendum) => (
                  <TableRow key={addendum.id} className="border-border/30">
                    <TableCell className="font-medium">{addendum.description}</TableCell>
                    <TableCell>{format(new Date(addendum.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right">
                      ${Number(addendum.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(addendum)}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(addendum)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
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
        onOpenChange={setShowAddDialog}
        purchaseOrderId={purchaseOrderId}
        purchaseOrderNumber={purchaseOrderNumber}
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
