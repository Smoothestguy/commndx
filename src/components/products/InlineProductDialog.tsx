import { useState, useEffect, useMemo } from "react";
import { Package, Wrench, HardHat, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAddProduct,
  Product,
  ItemType,
} from "@/integrations/supabase/hooks/useProducts";
import {
  useProductCategories,
  useAddProductCategory,
} from "@/integrations/supabase/hooks/useProductCategories";
import {
  useProductUnits,
  useAddProductUnit,
} from "@/integrations/supabase/hooks/useProductUnits";

const typeConfig: Record<
  ItemType,
  { icon: typeof Package; label: string; defaultUnit: string; showSku: boolean }
> = {
  product: {
    icon: Package,
    label: "Product",
    defaultUnit: "each",
    showSku: true,
  },
  service: {
    icon: Wrench,
    label: "Service",
    defaultUnit: "each",
    showSku: false,
  },
  labor: { icon: HardHat, label: "Labor", defaultUnit: "hour", showSku: false },
};

const marginPresets = ["15", "20", "25", "30", "35", "40", "45", "50"];

interface InlineProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (product: Product) => void;
  defaultItemType?: ItemType;
}

export function InlineProductDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultItemType = "product",
}: InlineProductDialogProps) {
  const { data: categories } = useProductCategories();
  const { data: units } = useProductUnits();
  const addProduct = useAddProduct();
  const addCategory = useAddProductCategory();
  const addUnit = useAddProductUnit();

  const [formData, setFormData] = useState({
    item_type: defaultItemType as ItemType,
    sku: "",
    name: "",
    description: "",
    cost: "",
    margin: "30",
    unit: "each",
    category: "",
    is_taxable: true,
  });
  const [showCustomMargin, setShowCustomMargin] = useState(false);
  const [showNewUnitInput, setShowNewUnitInput] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Update unit when item type changes
  useEffect(() => {
    const config = typeConfig[formData.item_type];
    setFormData((prev) => ({
      ...prev,
      unit: config.defaultUnit,
      is_taxable: formData.item_type !== "labor",
    }));
  }, [formData.item_type]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        item_type: defaultItemType,
        sku: "",
        name: "",
        description: "",
        cost: "",
        margin: "30",
        unit: typeConfig[defaultItemType].defaultUnit,
        category: "",
        is_taxable: defaultItemType !== "labor",
      });
      setShowCustomMargin(false);
      setShowNewCategoryInput(false);
      setShowNewUnitInput(false);
    }
  }, [open, defaultItemType]);

  const categoriesForType = useMemo(() => {
    if (!categories) return [];
    return categories
      .filter((c) => c.item_type === formData.item_type)
      .map((c) => c.name)
      .sort();
  }, [categories, formData.item_type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(formData.cost);
    const margin = parseFloat(formData.margin);

    if (margin >= 100) {
      return;
    }
    const price = margin > 0 ? cost / (1 - margin / 100) : cost;

    const productData = {
      item_type: formData.item_type,
      sku: formData.sku || null,
      name: formData.name,
      description: formData.description,
      category: formData.category,
      unit: formData.unit,
      cost,
      markup: margin,
      price,
      is_taxable: formData.is_taxable,
    };

    const newProduct = await addProduct.mutateAsync(productData);
    
    if (newProduct && onSuccess) {
      onSuccess(newProduct);
    }
    
    onOpenChange(false);
  };

  const currentTypeConfig = typeConfig[formData.item_type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Create New Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Item Type Selector */}
          <div className="space-y-2">
            <Label>Item Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(typeConfig) as ItemType[]).map((type) => {
                const config = typeConfig[type];
                const Icon = config.icon;
                const isSelected = formData.item_type === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, item_type: type })
                    }
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary hover:border-primary/50"
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-sm font-medium">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* SKU - Only for products */}
            {currentTypeConfig.showSku && (
              <div className="space-y-2">
                <Label htmlFor="sku">SKU / Item Code</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) =>
                    setFormData({ ...formData, sku: e.target.value })
                  }
                  placeholder="e.g., SHNG-001"
                  className="bg-secondary border-border"
                />
              </div>
            )}
            <div
              className={`space-y-2 ${
                !currentTypeConfig.showSku ? "sm:col-span-2" : ""
              }`}
            >
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
                className="bg-secondary border-border"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              {!showNewCategoryInput ? (
                <Select
                  value={formData.category}
                  onValueChange={(value) => {
                    if (value === "__new__") {
                      setShowNewCategoryInput(true);
                      setNewCategoryName("");
                    } else {
                      setFormData({ ...formData, category: value });
                    }
                  }}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {categoriesForType.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                    <SelectItem
                      value="__new__"
                      className="text-primary font-medium"
                    >
                      + Add new category...
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2">
                  <Input
                    autoFocus
                    value={newCategoryName}
                    placeholder="Enter new category name"
                    className="bg-secondary border-border"
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && newCategoryName.trim()) {
                        e.preventDefault();
                        await addCategory.mutateAsync({
                          name: newCategoryName.trim(),
                          item_type: formData.item_type,
                        });
                        setFormData({
                          ...formData,
                          category: newCategoryName.trim(),
                        });
                        setShowNewCategoryInput(false);
                        setNewCategoryName("");
                      } else if (e.key === "Escape") {
                        setShowNewCategoryInput(false);
                        setNewCategoryName("");
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowNewCategoryInput(false);
                        setNewCategoryName("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!newCategoryName.trim()}
                      onClick={async () => {
                        if (newCategoryName.trim()) {
                          await addCategory.mutateAsync({
                            name: newCategoryName.trim(),
                            item_type: formData.item_type,
                          });
                          setFormData({
                            ...formData,
                            category: newCategoryName.trim(),
                          });
                          setShowNewCategoryInput(false);
                          setNewCategoryName("");
                        }
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              {!showNewUnitInput ? (
                <Select
                  value={formData.unit}
                  onValueChange={(value) => {
                    if (value === "__new__") {
                      setShowNewUnitInput(true);
                      setNewUnitName("");
                    } else {
                      setFormData({ ...formData, unit: value });
                    }
                  }}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {units?.map((unit) => (
                      <SelectItem key={unit.id} value={unit.name}>
                        {unit.name}
                      </SelectItem>
                    ))}
                    <SelectItem
                      value="__new__"
                      className="text-primary font-medium"
                    >
                      + Add new unit...
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2">
                  <Input
                    autoFocus
                    value={newUnitName}
                    placeholder="Enter new unit name"
                    className="bg-secondary border-border"
                    onChange={(e) => setNewUnitName(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && newUnitName.trim()) {
                        e.preventDefault();
                        await addUnit.mutateAsync({
                          name: newUnitName.trim(),
                        });
                        setFormData({
                          ...formData,
                          unit: newUnitName.trim(),
                        });
                        setShowNewUnitInput(false);
                        setNewUnitName("");
                      } else if (e.key === "Escape") {
                        setShowNewUnitInput(false);
                        setNewUnitName("");
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowNewUnitInput(false);
                        setNewUnitName("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!newUnitName.trim()}
                      onClick={async () => {
                        if (newUnitName.trim()) {
                          await addUnit.mutateAsync({
                            name: newUnitName.trim(),
                          });
                          setFormData({
                            ...formData,
                            unit: newUnitName.trim(),
                          });
                          setShowNewUnitInput(false);
                          setNewUnitName("");
                        }
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="bg-secondary border-border"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cost">Cost ($) *</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                value={formData.cost}
                onChange={(e) =>
                  setFormData({ ...formData, cost: e.target.value })
                }
                required
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="margin">Margin (%) *</Label>
              {!showCustomMargin ? (
                <Select
                  value={
                    marginPresets.includes(formData.margin)
                      ? formData.margin
                      : "__custom__"
                  }
                  onValueChange={(value) => {
                    if (value === "__custom__") {
                      setShowCustomMargin(true);
                    } else {
                      setFormData({ ...formData, margin: value });
                    }
                  }}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Select margin" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {marginPresets.map((preset) => (
                      <SelectItem key={preset} value={preset}>
                        {preset}%
                      </SelectItem>
                    ))}
                    <SelectItem
                      value="__custom__"
                      className="text-primary font-medium"
                    >
                      Custom...
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex gap-2">
                  <Input
                    id="margin"
                    type="number"
                    max="99.99"
                    value={formData.margin}
                    onChange={(e) =>
                      setFormData({ ...formData, margin: e.target.value })
                    }
                    required
                    autoFocus
                    className="bg-secondary border-border"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowCustomMargin(false);
                      if (!marginPresets.includes(formData.margin)) {
                        setFormData({ ...formData, margin: "30" });
                      }
                    }}
                  >
                    Done
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Taxable Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="is_taxable" className="cursor-pointer">
              Taxable
            </Label>
            <Switch
              id="is_taxable"
              checked={formData.is_taxable}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_taxable: checked })
              }
            />
          </div>

          {/* Calculated Price */}
          {formData.cost &&
            formData.margin &&
            parseFloat(formData.margin) < 100 && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-sm text-muted-foreground">
                  Calculated Price:
                </p>
                <p className="text-2xl font-heading font-bold text-primary">
                  $
                  {(parseFloat(formData.margin) > 0
                    ? parseFloat(formData.cost) /
                      (1 - parseFloat(formData.margin) / 100)
                    : parseFloat(formData.cost)
                  ).toFixed(2)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    / {formData.unit || currentTypeConfig.defaultUnit}
                  </span>
                </p>
              </div>
            )}
          {formData.margin && parseFloat(formData.margin) >= 100 && (
            <p className="text-sm text-destructive">
              Margin must be less than 100%
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="glow" disabled={addProduct.isPending}>
              {addProduct.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Add {currentTypeConfig.label}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
