import { useState, useEffect, useMemo } from "react";
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
import { Package, Wrench, HardHat, Loader2 } from "lucide-react";
import {
  useAddProduct,
  ItemType,
  Product,
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
  onProductCreated: (product: Product) => void;
}

export function InlineProductDialog({
  open,
  onOpenChange,
  onProductCreated,
}: InlineProductDialogProps) {
  const { data: categories } = useProductCategories();
  const { data: units } = useProductUnits();
  const addProduct = useAddProduct();
  const addCategory = useAddProductCategory();
  const addUnit = useAddProductUnit();

  const [formData, setFormData] = useState({
    item_type: "product" as ItemType,
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
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewUnitInput, setShowNewUnitInput] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  // Update unit when item type changes
  useEffect(() => {
    const config = typeConfig[formData.item_type];
    setFormData((prev) => ({
      ...prev,
      unit: config.defaultUnit,
      is_taxable: formData.item_type !== "labor",
    }));
  }, [formData.item_type]);

  const categoriesForType = useMemo(() => {
    if (!categories) return [];
    return categories
      .filter((c) => c.item_type === formData.item_type)
      .map((c) => c.name)
      .sort();
  }, [categories, formData.item_type]);

  const resetForm = () => {
    setFormData({
      item_type: "product",
      sku: "",
      name: "",
      description: "",
      cost: "",
      margin: "30",
      unit: "each",
      category: "",
      is_taxable: true,
    });
    setShowNewCategoryInput(false);
    setNewCategoryName("");
    setShowCustomMargin(false);
    setShowNewUnitInput(false);
    setNewUnitName("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(formData.cost);
    const margin = parseFloat(formData.margin);

    if (margin >= 100) return;
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
    onProductCreated(newProduct);
    onOpenChange(false);
  };

  const currentTypeConfig = typeConfig[formData.item_type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Quick Add Product</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary hover:border-primary/50"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {currentTypeConfig.showSku && (
              <div className="space-y-1">
                <Label htmlFor="inline-sku">SKU / Item Code</Label>
                <Input
                  id="inline-sku"
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
              className={`space-y-1 ${
                !currentTypeConfig.showSku ? "sm:col-span-2" : ""
              }`}
            >
              <Label htmlFor="inline-name">Name *</Label>
              <Input
                id="inline-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
                className="bg-secondary border-border"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Category *</Label>
              {!showNewCategoryInput ? (
                <Select
                  value={formData.category}
                  onValueChange={(value) => {
                    if (value === "__new__") {
                      setShowNewCategoryInput(true);
                    } else {
                      setFormData({ ...formData, category: value });
                    }
                  }}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriesForType.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                    <SelectItem
                      value="__new__"
                      className="text-primary font-medium"
                    >
                      + Add new...
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex gap-1">
                  <Input
                    autoFocus
                    value={newCategoryName}
                    placeholder="Category name"
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
                      } else if (e.key === "Escape") {
                        setShowNewCategoryInput(false);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowNewCategoryInput(false)}
                  >
                    ✕
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label>Unit</Label>
              {!showNewUnitInput ? (
                <Select
                  value={formData.unit}
                  onValueChange={(value) => {
                    if (value === "__new__") {
                      setShowNewUnitInput(true);
                    } else {
                      setFormData({ ...formData, unit: value });
                    }
                  }}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units?.map((unit) => (
                      <SelectItem key={unit.id} value={unit.name}>
                        {unit.name}
                      </SelectItem>
                    ))}
                    <SelectItem
                      value="__new__"
                      className="text-primary font-medium"
                    >
                      + Add new...
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex gap-1">
                  <Input
                    autoFocus
                    value={newUnitName}
                    placeholder="Unit name"
                    className="bg-secondary border-border"
                    onChange={(e) => setNewUnitName(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && newUnitName.trim()) {
                        e.preventDefault();
                        await addUnit.mutateAsync({ name: newUnitName.trim() });
                        setFormData({ ...formData, unit: newUnitName.trim() });
                        setShowNewUnitInput(false);
                      } else if (e.key === "Escape") {
                        setShowNewUnitInput(false);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowNewUnitInput(false)}
                  >
                    ✕
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="inline-description">Description</Label>
            <Input
              id="inline-description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="bg-secondary border-border"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="inline-cost">Cost ($) *</Label>
              <Input
                id="inline-cost"
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
            <div className="space-y-1">
              <Label>Margin (%) *</Label>
              {!showCustomMargin ? (
                <Select
                  value={
                    marginPresets.includes(formData.margin)
                      ? formData.margin
                      : "__custom__"
                  }
                  onValueChange={(value) => {
                    if (value === "__custom__") setShowCustomMargin(true);
                    else setFormData({ ...formData, margin: value });
                  }}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {marginPresets.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}%
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
                <div className="flex gap-1">
                  <Input
                    type="number"
                    max="99.99"
                    value={formData.margin}
                    onChange={(e) =>
                      setFormData({ ...formData, margin: e.target.value })
                    }
                    autoFocus
                    className="bg-secondary border-border"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCustomMargin(false)}
                  >
                    Done
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="inline-taxable" className="cursor-pointer">
              Taxable
            </Label>
            <Switch
              id="inline-taxable"
              checked={formData.is_taxable}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_taxable: checked })
              }
            />
          </div>

          {formData.cost &&
            formData.margin &&
            parseFloat(formData.margin) < 100 && (
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-xs text-muted-foreground">
                  Calculated Price:
                </p>
                <p className="text-xl font-bold text-primary">
                  $
                  {(parseFloat(formData.margin) > 0
                    ? parseFloat(formData.cost) /
                      (1 - parseFloat(formData.margin) / 100)
                    : parseFloat(formData.cost)
                  ).toFixed(2)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    / {formData.unit}
                  </span>
                </p>
              </div>
            )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="glow"
              disabled={addProduct.isPending}
            >
              {addProduct.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create & Add
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
