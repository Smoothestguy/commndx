import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Check, ChevronsUpDown, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalculatorInput } from "@/components/ui/calculator-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { InlineProductDialog } from "@/components/products/InlineProductDialog";
import { Product as FullProduct } from "@/integrations/supabase/hooks/useProducts";

interface LineItem {
  id: string;
  product_id?: string;
  product_name?: string;
  description: string;
  quantity: string;
  unit_price: string;
  margin: string;
  pricing_type: 'markup' | 'margin';
  is_taxable: boolean;
  total: number;
}

interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  markup: number;
  unit: string;
  category: string;
  sku?: string | null;
  item_type?: string | null;
  is_taxable?: boolean | null;
}

interface SortableLineItemProps {
  item: LineItem;
  index: number;
  products: Product[] | undefined;
  isCustomerTaxExempt: boolean;
  canDelete: boolean;
  productComboboxOpen: boolean;
  productSearch: string;
  errors: Record<string, string>;
  isExpanded: boolean;
  onToggleExpand: () => void;
  getProductsByType: (type: 'product' | 'service' | 'labor') => Product[];
  onUpdateItem: (index: number, field: keyof Omit<LineItem, 'id'>, value: string | boolean) => void;
  onRemoveItem: (index: number) => void;
  onSelectProduct: (index: number, productId: string) => void;
  onSetProductComboboxOpen: (index: number, open: boolean) => void;
  onSetProductSearch: (index: number, value: string) => void;
}

export function SortableLineItem({
  item,
  index,
  products,
  isCustomerTaxExempt,
  canDelete,
  productComboboxOpen,
  productSearch,
  errors,
  isExpanded,
  onToggleExpand,
  getProductsByType,
  onUpdateItem,
  onRemoveItem,
  onSelectProduct,
  onSetProductComboboxOpen,
  onSetProductSearch,
}: SortableLineItemProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  
  const handleProductCreated = (newProduct: FullProduct) => {
    onSelectProduct(index, newProduct.id);
    onSetProductComboboxOpen(index, false);
    onSetProductSearch(index, "");
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  // Get display name for collapsed view
  const productName = item.product_name || (item.product_id 
    ? products?.find(p => p.id === item.product_id)?.name 
    : null);
  const displayDescription = productName || item.description || "No description";
  const truncatedDescription = displayDescription.length > 50 
    ? displayDescription.substring(0, 50) + "..." 
    : displayDescription;

  // Check if this line item has any errors
  const hasErrors = Object.keys(errors).some(key => key.startsWith(`line_${index}_`));

  return (
    <>
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "rounded-lg bg-secondary/50 border border-border",
          isDragging && "shadow-lg ring-2 ring-primary/20"
        )}
      >
        {/* Compact Header (Always Visible) */}
        <div className="flex items-center gap-2 p-3">
          {/* Drag Handle */}
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none shrink-0"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>

          {/* Item Number */}
          <span className="text-sm font-medium shrink-0 w-14">Item {index + 1}</span>

          {/* Expand/Collapse Toggle */}
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform duration-200",
                isExpanded && "rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>

          {/* Description (truncated) - only shown when collapsed */}
          {!isExpanded && (
            <>
              {/* Error indicator badge */}
              {hasErrors && (
                <Badge variant="destructive" className="text-xs shrink-0">
                  Error
                </Badge>
              )}

              <span className="text-sm text-muted-foreground truncate flex-1 min-w-0">
                {truncatedDescription}
              </span>
              
              {/* Quantity × Price */}
              <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                {item.quantity} × ${parseFloat(item.unit_price || "0").toFixed(2)}
              </span>

              {/* Line Total */}
              <span className="text-sm font-semibold shrink-0 min-w-[80px] text-right">
                ${item.total.toFixed(2)}
              </span>

              {/* Taxable Badge */}
              {item.is_taxable && !isCustomerTaxExempt && (
                <Badge variant="outline" className="text-xs shrink-0 hidden sm:inline-flex">
                  Tax
                </Badge>
              )}
            </>
          )}

          {/* Delete Button (always visible) */}
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRemoveItem(index)}
              className="h-7 w-7 p-0 shrink-0 ml-auto"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>

        {/* Expandable Content */}
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border/50">
            {/* Taxable Toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id={`taxable-${item.id}`}
                checked={item.is_taxable}
                onCheckedChange={(checked) => onUpdateItem(index, "is_taxable", checked)}
                disabled={isCustomerTaxExempt}
              />
              <Label htmlFor={`taxable-${item.id}`} className="text-xs text-muted-foreground">
                Taxable
              </Label>
            </div>

            {/* Product Combobox with Grouped Types */}
            <div className="space-y-2">
              <Label>Select Product (Optional)</Label>
              <div className="flex gap-2">
                <Popover 
                  open={productComboboxOpen} 
                  onOpenChange={(open) => onSetProductComboboxOpen(index, open)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={productComboboxOpen}
                      className="flex-1 justify-between bg-secondary border-border"
                    >
                      {item.product_id
                        ? products?.find((p) => p.id === item.product_id)?.name || 'Unknown product'
                        : "Search product, service, or labor..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[500px] p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Search by name, SKU, or category..." 
                        value={productSearch}
                        onValueChange={(v) => onSetProductSearch(index, v)}
                      />
                      <CommandList>
                        <CommandEmpty>No product found.</CommandEmpty>
                        {/* Create New Item at TOP for visibility */}
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => {
                              setCreateDialogOpen(true);
                              onSetProductComboboxOpen(index, false);
                            }}
                            className="text-primary font-medium"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Create New Item...
                          </CommandItem>
                        </CommandGroup>
                        <CommandSeparator />
                        {getProductsByType('product').length > 0 && (
                          <CommandGroup heading="Products">
                            {getProductsByType('product').map((product) => (
                              <CommandItem
                                key={product.id}
                                value={`${product.name} ${product.sku || ''} ${product.category}`}
                                onSelect={() => {
                                  onSelectProduct(index, product.id);
                                  onSetProductComboboxOpen(index, false);
                                  onSetProductSearch(index, "");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    item.product_id === product.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium truncate">{product.name}</span>
                                    <span className="text-sm font-medium text-muted-foreground shrink-0">${product.price.toFixed(2)}/{product.unit}</span>
                                  </div>
                                  {product.description && (
                                    <span className="text-xs text-muted-foreground line-clamp-1">{product.description}</span>
                                  )}
                                  <span className="text-xs text-muted-foreground/70">{product.category}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                        {getProductsByType('service').length > 0 && (
                          <CommandGroup heading="Services">
                            {getProductsByType('service').map((product) => (
                              <CommandItem
                                key={product.id}
                                value={`${product.name} ${product.sku || ''} ${product.category}`}
                                onSelect={() => {
                                  onSelectProduct(index, product.id);
                                  onSetProductComboboxOpen(index, false);
                                  onSetProductSearch(index, "");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    item.product_id === product.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium truncate">{product.name}</span>
                                    <span className="text-sm font-medium text-muted-foreground shrink-0">${product.price.toFixed(2)}/{product.unit}</span>
                                  </div>
                                  {product.description && (
                                    <span className="text-xs text-muted-foreground line-clamp-1">{product.description}</span>
                                  )}
                                  <span className="text-xs text-muted-foreground/70">{product.category}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                        {getProductsByType('labor').length > 0 && (
                          <CommandGroup heading="Labor">
                            {getProductsByType('labor').map((product) => (
                              <CommandItem
                                key={product.id}
                                value={`${product.name} ${product.sku || ''} ${product.category}`}
                                onSelect={() => {
                                  onSelectProduct(index, product.id);
                                  onSetProductComboboxOpen(index, false);
                                  onSetProductSearch(index, "");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    item.product_id === product.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium truncate">{product.name}</span>
                                    <span className="text-sm font-medium text-muted-foreground shrink-0">${product.price.toFixed(2)}/{product.unit}</span>
                                  </div>
                                  {product.description && (
                                    <span className="text-xs text-muted-foreground line-clamp-1">{product.description}</span>
                                  )}
                                  <span className="text-xs text-muted-foreground/70">{product.category}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {/* Always visible create button */}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCreateDialogOpen(true)}
                  title="Create New Item"
                  className="shrink-0 bg-secondary border-border hover:bg-primary hover:text-primary-foreground"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Product Name (read-only, displayed when a product is selected) */}
              {item.product_name && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Product Name</Label>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{item.product_name}</span>
                    {item.product_id && (
                      <Badge variant="secondary" className="text-xs">
                        {products?.find(p => p.id === item.product_id)?.unit}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Description Textarea */}
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center gap-2">
                  <Label>Description {!item.product_name && '*'}</Label>
                  {item.product_id && !item.product_name && (
                    <Badge variant="secondary" className="text-xs">
                      {products?.find(p => p.id === item.product_id)?.unit}
                    </Badge>
                  )}
                </div>
                <Textarea
                  value={item.description}
                  onChange={(e) => {
                    onUpdateItem(index, "description", e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  placeholder="Enter a detailed description of the work or product..."
                  className="bg-secondary border-border min-h-[60px] resize-none overflow-hidden"
                  rows={2}
                />
                {errors[`line_${index}_description`] && (
                  <p className="text-sm text-destructive">{errors[`line_${index}_description`]}</p>
                )}
              </div>

              {/* First row: Quantity and Unit Price */}
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.quantity}
                  onChange={(e) => onUpdateItem(index, "quantity", e.target.value)}
                  className="bg-secondary border-border"
                />
                {errors[`line_${index}_quantity`] && (
                  <p className="text-sm text-destructive">{errors[`line_${index}_quantity`]}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Unit Price ($) *</Label>
                <CalculatorInput
                  value={item.unit_price}
                  onValueChange={(value) => onUpdateItem(index, "unit_price", value.toString())}
                  placeholder="0.00"
                  className="bg-secondary border-border"
                />
                {errors[`line_${index}_unit_price`] && (
                  <p className="text-sm text-destructive">{errors[`line_${index}_unit_price`]}</p>
                )}
              </div>

              {/* Second row: Pricing Type and Margin */}
              <div className="space-y-2">
                <Label>Pricing Type</Label>
                <Select
                  value={item.pricing_type}
                  onValueChange={(value: 'markup' | 'margin') => onUpdateItem(index, "pricing_type", value)}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="margin">Margin</SelectItem>
                    <SelectItem value="markup">Markup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{item.pricing_type === 'margin' ? 'Margin' : 'Markup'} (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.margin}
                  onChange={(e) => onUpdateItem(index, "margin", e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
            </div>

            {/* Line Total */}
            <div className="flex justify-end pt-2 border-t border-border">
              <div className="text-right">
                <span className="text-sm text-muted-foreground">Line Total: </span>
                <span className="text-lg font-semibold">${item.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
    
    <InlineProductDialog
      open={createDialogOpen}
      onOpenChange={setCreateDialogOpen}
      onSuccess={handleProductCreated}
    />
    </>
  );
}