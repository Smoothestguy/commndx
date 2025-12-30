import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Undo2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import {
  DeletedItem,
  TrashEntityType,
  useRestoreItem,
  usePermanentlyDelete,
  getEntityLabel,
} from "@/integrations/supabase/hooks/useTrash";
import { useUserRole } from "@/hooks/useUserRole";

interface TrashTableProps {
  items: DeletedItem[];
  isLoading: boolean;
  showEntityType?: boolean;
}

export function TrashTable({ items, isLoading, showEntityType = true }: TrashTableProps) {
  const { isAdmin } = useUserRole();
  const restoreMutation = useRestoreItem();
  const permanentDeleteMutation = usePermanentlyDelete();

  const [confirmDelete, setConfirmDelete] = useState<DeletedItem | null>(null);

  const handleRestore = (item: DeletedItem) => {
    restoreMutation.mutate({ entityType: item.entity_type, id: item.id });
  };

  const handlePermanentDelete = () => {
    if (!confirmDelete) return;
    permanentDeleteMutation.mutate(
      { entityType: confirmDelete.entity_type, id: confirmDelete.id },
      { onSuccess: () => setConfirmDelete(null) }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Trash2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
        <p>No deleted items found</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {showEntityType && <TableHead>Type</TableHead>}
              <TableHead>Identifier</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Deleted At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={`${item.entity_type}-${item.id}`}>
                {showEntityType && (
                  <TableCell>
                    <Badge variant="outline" className="whitespace-nowrap">
                      {getEntityLabel(item.entity_type)}
                    </Badge>
                  </TableCell>
                )}
                <TableCell className="font-medium">{item.identifier}</TableCell>
                <TableCell>{item.name || "-"}</TableCell>
                <TableCell>
                  {format(new Date(item.deleted_at), "MMM d, yyyy h:mm a")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(item)}
                      disabled={restoreMutation.isPending}
                    >
                      <Undo2 className="h-4 w-4 mr-1" />
                      Restore
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setConfirmDelete(item)}
                        disabled={permanentDeleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete Forever
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{" "}
              <strong>{confirmDelete?.identifier}</strong> and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
