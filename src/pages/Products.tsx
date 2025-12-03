import { useState, useEffect, useMemo } from "react";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Edit, Trash2, Loader2, Package, Wrench, HardHat, Cloud, RefreshCw, X } from "lucide-react";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useProducts, useAddProduct, useUpdateProduct, useDeleteProduct, useDeleteProducts, Product, ItemType } from "@/integrations/supabase/hooks/useProducts";
import { BulkEditProductsDialog } from "@/components/products/BulkEditProductsDialog";
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
import { useProductCategories, useAddProductCategory } from "@/integrations/supabase/hooks/useProductCategories";
import { useProductUnits, useAddProductUnit } from "@/integrations/supabase/hooks/useProductUnits";
import { useIsMobile } from "@/hooks/use-mobile";
import { ProductCard } from "@/components/products/ProductCard";
import { ProductStats } from "@/components/products/ProductStats";
import { ProductFilters } from "@/components/products/ProductFilters";
import { ProductEmptyState } from "@/components/products/ProductEmptyState";
import { useQuickBooksConfig, useImportProductsFromQB, useExportProductsToQB, useQuickBooksConflicts } from "@/integrations/supabase/hooks/useQuickBooks";
import { ProductConflictDialog } from "@/components/quickbooks/ProductConflictDialog";
import { Badge } from "@/components/ui/badge";

const typeConfig: Record<ItemType, { icon: typeof Package; label: string; defaultUnit: string; showSku: boolean }> = {
  product: { icon: Package, label: "Product", defaultUnit: "each", showSku: true },
  service: { icon: Wrench, label: "Service", defaultUnit: "each", showSku: false },
  labor: { icon: HardHat, label: "Labor", defaultUnit: "hour", showSku: false },
};

const marginPresets = ["15", "20", "25", "30", "35", "40", "45", "50"];

const Products = () => {
  const { data: products, isLoading, error, refetch, isFetching } = useProducts();
  const { data: categories } = useProductCategories();
  const { data: units } = useProductUnits();
  const addProduct = useAddProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const deleteProducts = useDeleteProducts();
  const addCategory = useAddProductCategory();
  const addUnit = useAddProductUnit();
  const isMobile = useIsMobile();
  
  // QuickBooks hooks
  const { data: qbConfig } = useQuickBooksConfig();
  const { data: qbConflicts } = useQuickBooksConflicts();
  const importProducts = useImportProductsFromQB();
  const exportProducts = useExportProductsToQB();
  const [selectedConflict, setSelectedConflict] = useState<any>(null);
  
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedType, setSelectedType] = useState<ItemType | "">("");
  const [selectedLetter, setSelectedLetter] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
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
  const [showNewUnitInput, setShowNewUnitInput] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  
  // Bulk selection state
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);

  // Update unit when item type changes (only for new items)
  useEffect(() => {
    if (!editingProduct) {
      const config = typeConfig[formData.item_type];
      setFormData(prev => ({
        ...prev,
        unit: config.defaultUnit,
        is_taxable: formData.item_type !== "labor", // Labor often non-taxable
      }));
    }
  }, [formData.item_type, editingProduct]);

  const uniqueCategories = Array.from(new Set(products?.map((p) => p.category) || []));

  // Get categories filtered by item type for the form dropdown (from dedicated table)
  const categoriesForType = useMemo(() => {
    if (!categories) return [];
    return categories
      .filter(c => c.item_type === formData.item_type)
      .map(c => c.name)
      .sort();
  }, [categories, formData.item_type]);

  // State for new category input
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const filteredProducts = products?.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    const matchesType = !selectedType || p.item_type === selectedType;
    
    // Letter filter
    let matchesLetter = true;
    if (selectedLetter) {
      const firstChar = p.name.charAt(0).toUpperCase();
      matchesLetter = selectedLetter === '#' 
        ? /[0-9]/.test(firstChar) 
        : firstChar === selectedLetter;
    }
    
    return matchesSearch && matchesCategory && matchesType && matchesLetter;
  }) || [];

  const columns = [
    { key: "name", header: "Name" },
    {
      key: "item_type",
      header: "Type",
      render: (item: Product) => {
        const config = typeConfig[item.item_type] || typeConfig.product;
        const Icon = config.icon;
        return (
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <span className="capitalize">{item.item_type}</span>
          </div>
        );
      },
    },
    { key: "category", header: "Category" },
    {
      key: "cost",
      header: "Cost",
      render: (item: Product) => `$${item.cost.toFixed(2)}`,
    },
    {
      key: "markup",
      header: "Margin",
      render: (item: Product) => `${item.markup}%`,
    },
    {
      key: "price",
      header: "Price",
      render: (item: Product) => (
        <span className="font-semibold text-primary">${item.price.toFixed(2)}</span>
      ),
    },
    { key: "unit", header: "Unit" },
    {
      key: "actions",
      header: "",
      render: (item: Product) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(item);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(item.id);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    const marginStr = product.markup.toString();
    setFormData({
      item_type: product.item_type || "product",
      sku: product.sku || "",
      name: product.name,
      description: product.description || "",
      cost: product.cost.toString(),
      margin: marginStr,
      unit: product.unit,
      category: product.category,
      is_taxable: product.is_taxable ?? true,
    });
    setShowCustomMargin(!marginPresets.includes(marginStr));
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteProduct.mutate(id);
  };

  const handleBulkDelete = () => {
    deleteProducts.mutate(Array.from(selectedProductIds), {
      onSuccess: () => {
        setSelectedProductIds(new Set());
        setShowBulkDeleteDialog(false);
      },
    });
  };

  const handleSelectionChange = (id: string, checked: boolean) => {
    setSelectedProductIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

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

    if (editingProduct) {
      await updateProduct.mutateAsync({
        id: editingProduct.id,
        ...productData,
      });
    } else {
      await addProduct.mutateAsync(productData);
    }

    setIsDialogOpen(false);
    setEditingProduct(null);
    resetForm();
  };

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

  const openNewDialog = () => {
    setEditingProduct(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const currentTypeConfig = typeConfig[formData.item_type];

  return (
    <>
      <SEO 
        title="Products & Services"
        description="Manage your products, services, and labor items"
        keywords="product management, services, labor, pricing, inventory"
      />
      <PageLayout
        title="Products & Services"
        description="Manage your products, services, and labor items"
        actions={
          <Button variant="glow" onClick={openNewDialog}>
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        }
      >
        <PullToRefreshWrapper onRefresh={refetch} isRefreshing={isFetching}>
          {/* Search */}
          <div className="mb-6 relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products, services..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-secondary border-border"
            />
          </div>

          {/* Loading & Error States */}
          {isLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          
          {error && (
            <div className="text-center py-12 text-destructive">
              Error loading products: {error.message}
            </div>
          )}

          {!isLoading && !error && (
            <>
              {/* Stats */}
              <ProductStats products={products || []} />

              {/* QuickBooks Sync Section */}
              {qbConfig?.is_connected && (
                <div className="mb-6 p-4 rounded-lg border bg-card">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Cloud className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-medium text-sm">QuickBooks Connected</p>
                        {qbConflicts && qbConflicts.length > 0 && (
                          <p className="text-xs text-orange-500">
                            {qbConflicts.length} price conflict{qbConflicts.length > 1 ? 's' : ''} to resolve
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {qbConflicts && qbConflicts.length > 0 && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedConflict(qbConflicts[0])}
                        >
                          Resolve Conflicts
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => importProducts.mutate()}
                        disabled={importProducts.isPending || exportProducts.isPending}
                      >
                        {importProducts.isPending ? (
                          <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Cloud className="h-4 w-4 mr-1" />
                        )}
                        Import
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => exportProducts.mutate()}
                        disabled={importProducts.isPending || exportProducts.isPending}
                      >
                        {exportProducts.isPending ? (
                          <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Cloud className="h-4 w-4 mr-1" />
                        )}
                        Export
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Filters */}
              <ProductFilters
                products={products || []}
                categories={uniqueCategories}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                selectedType={selectedType}
                onTypeChange={setSelectedType}
                selectedLetter={selectedLetter}
                onLetterChange={setSelectedLetter}
              />

              {/* Bulk Actions Toolbar */}
              {selectedProductIds.size > 0 && (
                <div className="flex items-center gap-4 p-4 bg-primary/10 border border-primary/20 rounded-lg mb-4 animate-fade-in">
                  <span className="text-sm font-medium text-foreground">
                    {selectedProductIds.size} item{selectedProductIds.size > 1 ? 's' : ''} selected
                  </span>
                  <div className="flex items-center gap-2 ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowBulkEditDialog(true)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Selected
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowBulkDeleteDialog(true)}
                      disabled={deleteProducts.isPending}
                    >
                      {deleteProducts.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Delete Selected
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedProductIds(new Set())}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  </div>
                </div>
              )}

              {/* Products Display */}
              {filteredProducts.length === 0 ? (
                <ProductEmptyState
                  onAddProduct={openNewDialog}
                  hasFilters={search !== "" || selectedCategory !== "" || selectedType !== "" || selectedLetter !== ""}
                />
              ) : isMobile ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {filteredProducts.map((product, index) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      index={index}
                      selectable
                      isSelected={selectedProductIds.has(product.id)}
                      onSelectChange={handleSelectionChange}
                    />
                  ))}
                </div>
              ) : (
                <DataTable 
                  data={filteredProducts} 
                  columns={columns}
                  selectable
                  selectedIds={selectedProductIds}
                  onSelectionChange={setSelectedProductIds}
                />
              )}
            </>
          )}
        </PullToRefreshWrapper>

        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">
                {editingProduct ? "Edit Item" : "Add New Item"}
              </DialogTitle>
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
                        onClick={() => setFormData({ ...formData, item_type: type })}
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
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="e.g., SHNG-001"
                      className="bg-secondary border-border"
                    />
                  </div>
                )}
                <div className={`space-y-2 ${!currentTypeConfig.showSku ? 'sm:col-span-2' : ''}`}>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                        <SelectItem value="__new__" className="text-primary font-medium">
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
                              item_type: formData.item_type 
                            });
                            setFormData({ ...formData, category: newCategoryName.trim() });
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
                                item_type: formData.item_type 
                              });
                              setFormData({ ...formData, category: newCategoryName.trim() });
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
                        <SelectItem value="__new__" className="text-primary font-medium">
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
                            await addUnit.mutateAsync({ name: newUnitName.trim() });
                            setFormData({ ...formData, unit: newUnitName.trim() });
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
                              await addUnit.mutateAsync({ name: newUnitName.trim() });
                              setFormData({ ...formData, unit: newUnitName.trim() });
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
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    required
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="margin">Margin (%) *</Label>
                  {!showCustomMargin ? (
                    <Select
                      value={marginPresets.includes(formData.margin) ? formData.margin : "__custom__"}
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
                        <SelectItem value="__custom__" className="text-primary font-medium">
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
                        onChange={(e) => setFormData({ ...formData, margin: e.target.value })}
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
                <Label htmlFor="is_taxable" className="cursor-pointer">Taxable</Label>
                <Switch
                  id="is_taxable"
                  checked={formData.is_taxable}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_taxable: checked })}
                />
              </div>

              {/* Calculated Price */}
              {formData.cost && formData.margin && parseFloat(formData.margin) < 100 && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm text-muted-foreground">Calculated Price:</p>
                  <p className="text-2xl font-heading font-bold text-primary">
                    ${(parseFloat(formData.margin) > 0 
                      ? parseFloat(formData.cost) / (1 - parseFloat(formData.margin) / 100) 
                      : parseFloat(formData.cost)
                    ).toFixed(2)}
                    <span className="text-sm font-normal text-muted-foreground ml-1">/ {formData.unit || currentTypeConfig.defaultUnit}</span>
                  </p>
                </div>
              )}
              {formData.margin && parseFloat(formData.margin) >= 100 && (
                <p className="text-sm text-destructive">Margin must be less than 100%</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="glow">
                  {editingProduct ? "Save Changes" : `Add ${currentTypeConfig.label}`}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* QuickBooks Conflict Dialog */}
        <ProductConflictDialog
          open={!!selectedConflict}
          onOpenChange={(open) => !open && setSelectedConflict(null)}
          conflict={selectedConflict}
        />

        {/* Bulk Delete Confirmation Dialog */}
        <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedProductIds.size} item{selectedProductIds.size > 1 ? 's' : ''}?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The selected items will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteProducts.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Edit Dialog */}
        <BulkEditProductsDialog
          open={showBulkEditDialog}
          onOpenChange={setShowBulkEditDialog}
          selectedIds={Array.from(selectedProductIds)}
          products={products || []}
          onSuccess={() => setSelectedProductIds(new Set())}
        />
      </PageLayout>
    </>
  );
};

export default Products;
