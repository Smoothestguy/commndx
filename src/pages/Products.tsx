import { useState } from "react";
import { SEO } from "@/components/SEO";
import { PageLayout } from "@/components/layout/PageLayout";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, Loader2 } from "lucide-react";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useProducts, useAddProduct, useUpdateProduct, useDeleteProduct, Product } from "@/integrations/supabase/hooks/useProducts";
import { useIsMobile } from "@/hooks/use-mobile";
import { ProductCard } from "@/components/products/ProductCard";
import { ProductStats } from "@/components/products/ProductStats";
import { ProductFilters } from "@/components/products/ProductFilters";
import { ProductEmptyState } from "@/components/products/ProductEmptyState";

const Products = () => {
  const { data: products, isLoading, error, refetch, isFetching } = useProducts();
  const addProduct = useAddProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const isMobile = useIsMobile();
  
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    cost: "",
    margin: "",
    unit: "",
    category: "",
  });

  const uniqueCategories = Array.from(new Set(products?.map((p) => p.category) || []));

  const filteredProducts = products?.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }) || [];

  const columns = [
    { key: "name", header: "Product Name" },
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
      name: product.name,
      description: product.description || "",
      cost: product.cost.toString(),
      margin: product.markup.toString(),
      unit: product.unit,
      category: product.category,
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
    
    // Margin-based pricing: price = cost / (1 - margin/100)
    // Margin cannot be >= 100%
    if (margin >= 100) {
      return;
    }
    const price = margin > 0 ? cost / (1 - margin / 100) : cost;

    if (editingProduct) {
      await updateProduct.mutateAsync({
        id: editingProduct.id,
        name: formData.name,
        description: formData.description,
        category: formData.category,
        unit: formData.unit,
        cost,
        markup: margin, // DB column is still named "markup"
        price,
      });
    } else {
      await addProduct.mutateAsync({
        name: formData.name,
        description: formData.description,
        category: formData.category,
        unit: formData.unit,
        cost,
        markup: margin, // DB column is still named "markup"
        price,
      });
    }

    setIsDialogOpen(false);
    setEditingProduct(null);
    setFormData({ name: "", description: "", cost: "", margin: "", unit: "", category: "" });
  };

  const openNewDialog = () => {
    setEditingProduct(null);
    setFormData({ name: "", description: "", cost: "", margin: "", unit: "", category: "" });
    setIsDialogOpen(true);
  };

  return (
    <>
      <SEO 
        title="Products"
        description="Manage your product catalog and inventory with Command X"
        keywords="product management, inventory, product catalog, pricing, services"
      />
      <PageLayout
      title="Products"
      description="Manage your products and services"
      actions={
        <Button variant="glow" onClick={openNewDialog}>
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      }
    >
      <PullToRefreshWrapper onRefresh={refetch} isRefreshing={isFetching}>
        {/* Search */}
        <div className="mb-6 relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
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
            />

            {/* Products Display */}
            {filteredProducts.length === 0 ? (
              <ProductEmptyState
                onAddProduct={openNewDialog}
                hasFilters={search !== "" || selectedCategory !== ""}
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
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingProduct ? "Edit Product" : "Add New Product"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
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
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cost">Cost ($)</Label>
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
                <Label htmlFor="margin">Margin (%)</Label>
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
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Input
                  id="unit"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="e.g., piece, hour"
                  className="bg-secondary border-border"
                />
              </div>
            </div>
            {formData.cost && formData.margin && parseFloat(formData.margin) < 100 && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-sm text-muted-foreground">Calculated Price:</p>
                <p className="text-2xl font-heading font-bold text-primary">
                  ${(parseFloat(formData.margin) > 0 
                    ? parseFloat(formData.cost) / (1 - parseFloat(formData.margin) / 100) 
                    : parseFloat(formData.cost)
                  ).toFixed(2)}
                </p>
              </div>
            )}
            {formData.margin && parseFloat(formData.margin) >= 100 && (
              <p className="text-sm text-destructive">Margin must be less than 100%</p>
            )}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="glow">
                {editingProduct ? "Save Changes" : "Add Product"}
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
