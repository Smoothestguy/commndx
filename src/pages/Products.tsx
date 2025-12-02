import { useState, useEffect } from "react";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, Loader2, Package, Wrench, HardHat } from "lucide-react";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useProducts, useAddProduct, useUpdateProduct, useDeleteProduct, Product, ItemType } from "@/integrations/supabase/hooks/useProducts";
import { useIsMobile } from "@/hooks/use-mobile";
import { ProductCard } from "@/components/products/ProductCard";
import { ProductStats } from "@/components/products/ProductStats";
import { ProductFilters } from "@/components/products/ProductFilters";
import { ProductEmptyState } from "@/components/products/ProductEmptyState";

const typeConfig: Record<ItemType, { icon: typeof Package; label: string; defaultUnit: string; showSku: boolean }> = {
  product: { icon: Package, label: "Product", defaultUnit: "each", showSku: true },
  service: { icon: Wrench, label: "Service", defaultUnit: "each", showSku: false },
  labor: { icon: HardHat, label: "Labor", defaultUnit: "hour", showSku: false },
};

const Products = () => {
  const { data: products, isLoading, error, refetch, isFetching } = useProducts();
  const addProduct = useAddProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const isMobile = useIsMobile();
  
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedType, setSelectedType] = useState<ItemType | "">("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    item_type: "product" as ItemType,
    sku: "",
    name: "",
    description: "",
    cost: "",
    margin: "",
    unit: "each",
    category: "",
    is_taxable: true,
  });

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

  const filteredProducts = products?.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    const matchesType = !selectedType || p.item_type === selectedType;
    return matchesSearch && matchesCategory && matchesType;
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
    setFormData({
      item_type: product.item_type || "product",
      sku: product.sku || "",
      name: product.name,
      description: product.description || "",
      cost: product.cost.toString(),
      margin: product.markup.toString(),
      unit: product.unit,
      category: product.category,
      is_taxable: product.is_taxable ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteProduct.mutate(id);
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
      margin: "",
      unit: "each",
      category: "",
      is_taxable: true,
    });
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

              {/* Filters */}
              <ProductFilters
                categories={uniqueCategories}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                selectedType={selectedType}
                onTypeChange={setSelectedType}
              />

              {/* Products Display */}
              {filteredProducts.length === 0 ? (
                <ProductEmptyState
                  onAddProduct={openNewDialog}
                  hasFilters={search !== "" || selectedCategory !== "" || selectedType !== ""}
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
                    />
                  ))}
                </div>
              ) : (
                <DataTable data={filteredProducts} columns={columns} />
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
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder={formData.item_type === "labor" ? "e.g., Installation" : "e.g., Materials"}
                    required
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder={currentTypeConfig.defaultUnit}
                    className="bg-secondary border-border"
                  />
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
                  <Input
                    id="margin"
                    type="number"
                    max="99.99"
                    value={formData.margin}
                    onChange={(e) => setFormData({ ...formData, margin: e.target.value })}
                    required
                    className="bg-secondary border-border"
                  />
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
      </PageLayout>
    </>
  );
};

export default Products;
