import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Loader2, ArrowLeft, Edit, DollarSign } from "lucide-react";
import { useQBProductMappings, useCreateQBProductMapping, useDeleteQBProductMapping } from "@/integrations/supabase/hooks/useQBProductMappings";
import { useProducts, Product } from "@/integrations/supabase/hooks/useProducts";

interface ManageUmbrellasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddItem?: (umbrellaId: string) => void;
  onEditItem?: (product: Product) => void;
}

export function ManageUmbrellasDialog({ open, onOpenChange, onAddItem, onEditItem }: ManageUmbrellasDialogProps) {
  const { data: umbrellas = [], isLoading } = useQBProductMappings();
  const { data: products = [] } = useProducts();
  const createMapping = useCreateQBProductMapping();
  const deleteMapping = useDeleteQBProductMapping();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("Service");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [selectedUmbrella, setSelectedUmbrella] = useState<string | null>(null);

  const getProductCount = (umbrellaId: string) =>
    products.filter((p) => (p as any).qb_product_mapping_id === umbrellaId).length;

  const getProductsForUmbrella = (umbrellaId: string) =>
    products.filter((p) => (p as any).qb_product_mapping_id === umbrellaId);

  const selectedUmbrellaData = umbrellas.find((u) => u.id === selectedUmbrella);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createMapping.mutateAsync({ name: newName.trim(), quickbooks_item_type: newType });
    setNewName("");
    setNewType("Service");
    setShowCreateForm(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMapping.mutateAsync(deleteTarget);
    setDeleteTarget(null);
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setSelectedUmbrella(null);
      setShowCreateForm(false);
    }
    onOpenChange(o);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            {selectedUmbrella && selectedUmbrellaData ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSelectedUmbrella(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <DialogTitle className="truncate">{selectedUmbrellaData.name}</DialogTitle>
              </div>
            ) : (
              <DialogTitle>Manage QB Umbrella Categories</DialogTitle>
            )}
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-y-auto">
            {selectedUmbrella && selectedUmbrellaData ? (
              /* ===== DETAIL VIEW ===== */
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {selectedUmbrellaData.quickbooks_item_type || "Service"}
                    </Badge>
                    {selectedUmbrellaData.quickbooks_item_id && (
                      <Badge variant="outline" className="text-xs text-green-600">Synced</Badge>
                    )}
                  </div>
                  {onAddItem && (
                    <Button size="sm" variant="glow" onClick={() => onAddItem(selectedUmbrella)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  )}
                </div>

                {(() => {
                  const umbrellaProducts = getProductsForUmbrella(selectedUmbrella);
                  if (umbrellaProducts.length === 0) {
                    return (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No items under this umbrella yet.
                        {onAddItem && " Click \"Add Item\" to create one."}
                      </p>
                    );
                  }
                  return (
                    <div className="space-y-2">
                      {umbrellaProducts.map((product) => (
                        <div
                          key={product.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{product.name}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                Cost: ${product.cost.toFixed(2)}
                              </span>
                              <span>Price: ${product.price.toFixed(2)}</span>
                              <span>{product.unit}</span>
                            </div>
                          </div>
                          {onEditItem && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-foreground shrink-0"
                              onClick={() => onEditItem(product)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </>
            ) : (
              /* ===== LIST VIEW ===== */
              <>
                {/* Create Form */}
                {showCreateForm ? (
                  <div className="p-3 border rounded-lg space-y-3 bg-muted/30">
                    <Input
                      placeholder="Umbrella name (e.g. Subcontract Labor - Flooring)"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Select value={newType} onValueChange={setNewType}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Service">Service</SelectItem>
                          <SelectItem value="NonInventory">Non-Inventory Product</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        onClick={handleCreate}
                        disabled={!newName.trim() || createMapping.isPending}
                      >
                        {createMapping.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowCreateForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => setShowCreateForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Umbrella
                  </Button>
                )}

                {/* List */}
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : umbrellas.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No umbrella categories yet. Create one to get started.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {umbrellas.map((u) => {
                      const count = getProductCount(u.id);
                      return (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setSelectedUmbrella(u.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{u.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {u.quickbooks_item_type || "Service"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {count} item{count !== 1 ? "s" : ""}
                              </span>
                              {u.quickbooks_item_id && (
                                <Badge variant="outline" className="text-xs text-green-600">
                                  Synced
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(u.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Umbrella Category?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the umbrella category. Products already linked to it will keep their data, but the umbrella won't appear in new selections.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
