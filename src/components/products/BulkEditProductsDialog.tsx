import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, AlertTriangle } from "lucide-react";
import { Product, useBulkUpdateProducts, BulkUpdateData, ItemType } from "@/integrations/supabase/hooks/useProducts";
import { useProductCategories, useAddProductCategory } from "@/integrations/supabase/hooks/useProductCategories";
import { useProductUnits, useAddProductUnit } from "@/integrations/supabase/hooks/useProductUnits";

const marginPresets = ["15", "20", "25", "30", "35", "40", "45", "50"];

interface BulkEditProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  products: Product[];
  onSuccess: () => void;
}

export function BulkEditProductsDialog({
  open,
  onOpenChange,
  selectedIds,
  products,
  onSuccess,
}: BulkEditProductsDialogProps) {
  const bulkUpdate = useBulkUpdateProducts();
  const { data: categories } = useProductCategories();
  const { data: units } = useProductUnits();
  const addCategory = useAddProductCategory();
  const addUnit = useAddProductUnit();

  // Field enable states
  const [enableCategory, setEnableCategory] = useState(false);
  const [enableMargin, setEnableMargin] = useState(false);
  const [enableUnit, setEnableUnit] = useState(false);
  const [enableTaxable, setEnableTaxable] = useState(false);

  // Field values
  const [category, setCategory] = useState("");
  const [margin, setMargin] = useState("30");
  const [showCustomMargin, setShowCustomMargin] = useState(false);
  const [unit, setUnit] = useState("each");
  const [isTaxable, setIsTaxable] = useState(true);

  // New category/unit inputs
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewUnitInput, setShowNewUnitInput] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");

  // Get selected products for determining common item_type
  const selectedProducts = products.filter(p => selectedIds.includes(p.id));
  const itemTypes = [...new Set(selectedProducts.map(p => p.item_type))];
  const hasMixedTypes = itemTypes.length > 1;
  const commonItemType: ItemType = hasMixedTypes ? "product" : (itemTypes[0] || "product");

  // Filter categories by common item type
  const categoriesForType = categories
    ?.filter(c => hasMixedTypes || c.item_type === commonItemType)
    .map(c => c.name)
    .sort() || [];

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    await addCategory.mutateAsync({ 
      name: newCategoryName.trim(), 
      item_type: commonItemType 
    });
    setCategory(newCategoryName.trim());
    setNewCategoryName("");
    setShowNewCategoryInput(false);
  };

  const handleAddUnit = async () => {
    if (!newUnitName.trim()) return;
    await addUnit.mutateAsync({ name: newUnitName.trim() });
    setUnit(newUnitName.trim());
    setNewUnitName("");
    setShowNewUnitInput(false);
  };

  const handleSubmit = async () => {
    const updates: BulkUpdateData = {};
    
    if (enableCategory && category) {
      updates.category = category;
    }
    if (enableMargin) {
      const marginValue = parseFloat(margin);
      if (!isNaN(marginValue) && marginValue >= 0 && marginValue < 100) {
        updates.markup = marginValue;
      }
    }
    if (enableUnit && unit) {
      updates.unit = unit;
    }
    if (enableTaxable) {
      updates.is_taxable = isTaxable;
    }

    if (Object.keys(updates).length === 0) {
      return;
    }

    await bulkUpdate.mutateAsync({
      ids: selectedIds,
      updates,
      products,
    });

    resetAndClose();
    onSuccess();
  };

  const resetAndClose = () => {
    setEnableCategory(false);
    setEnableMargin(false);
    setEnableUnit(false);
    setEnableTaxable(false);
    setCategory("");
    setMargin("30");
    setShowCustomMargin(false);
    setUnit("each");
    setIsTaxable(true);
    setShowNewCategoryInput(false);
    setNewCategoryName("");
    setShowNewUnitInput(false);
    setNewUnitName("");
    onOpenChange(false);
  };

  const hasChanges = enableCategory || enableMargin || enableUnit || enableTaxable;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">
            Bulk Edit {selectedIds.length} Item{selectedIds.length > 1 ? "s" : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {hasMixedTypes && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Selected items have mixed types. Category changes will apply to all.
              </p>
            </div>
          )}

          {/* Category Field */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Checkbox
                id="enable-category"
                checked={enableCategory}
                onCheckedChange={(checked) => setEnableCategory(checked === true)}
              />
              <Label htmlFor="enable-category" className="font-medium cursor-pointer">
                Update Category
              </Label>
            </div>
            {enableCategory && (
              <div className="ml-7 space-y-2">
                {showNewCategoryInput ? (
                  <div className="flex gap-2">
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="New category name"
                      className="bg-secondary"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddCategory}
                      disabled={!newCategoryName.trim() || addCategory.isPending}
                    >
                      {addCategory.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNewCategoryInput(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="bg-secondary">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoriesForType.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowNewCategoryInput(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Margin Field */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Checkbox
                id="enable-margin"
                checked={enableMargin}
                onCheckedChange={(checked) => setEnableMargin(checked === true)}
              />
              <Label htmlFor="enable-margin" className="font-medium cursor-pointer">
                Update Margin
              </Label>
            </div>
            {enableMargin && (
              <div className="ml-7 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {marginPresets.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant={margin === preset && !showCustomMargin ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setMargin(preset);
                        setShowCustomMargin(false);
                      }}
                    >
                      {preset}%
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant={showCustomMargin ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowCustomMargin(true)}
                  >
                    Custom
                  </Button>
                </div>
                {showCustomMargin && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={margin}
                      onChange={(e) => setMargin(e.target.value)}
                      className="w-24 bg-secondary"
                      min="0"
                      max="99"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Unit Field */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Checkbox
                id="enable-unit"
                checked={enableUnit}
                onCheckedChange={(checked) => setEnableUnit(checked === true)}
              />
              <Label htmlFor="enable-unit" className="font-medium cursor-pointer">
                Update Unit
              </Label>
            </div>
            {enableUnit && (
              <div className="ml-7 space-y-2">
                {showNewUnitInput ? (
                  <div className="flex gap-2">
                    <Input
                      value={newUnitName}
                      onChange={(e) => setNewUnitName(e.target.value)}
                      placeholder="New unit name"
                      className="bg-secondary"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddUnit}
                      disabled={!newUnitName.trim() || addUnit.isPending}
                    >
                      {addUnit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNewUnitInput(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Select value={unit} onValueChange={setUnit}>
                      <SelectTrigger className="bg-secondary">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {units?.map((u) => (
                          <SelectItem key={u.id} value={u.name}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowNewUnitInput(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Taxable Field */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Checkbox
                id="enable-taxable"
                checked={enableTaxable}
                onCheckedChange={(checked) => setEnableTaxable(checked === true)}
              />
              <Label htmlFor="enable-taxable" className="font-medium cursor-pointer">
                Update Taxable Status
              </Label>
            </div>
            {enableTaxable && (
              <div className="ml-7 flex items-center gap-3">
                <Switch
                  id="taxable"
                  checked={isTaxable}
                  onCheckedChange={setIsTaxable}
                />
                <Label htmlFor="taxable" className="cursor-pointer">
                  {isTaxable ? "Taxable" : "Non-taxable"}
                </Label>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!hasChanges || bulkUpdate.isPending}
          >
            {bulkUpdate.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              "Apply Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}