import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { CalculatorInput } from "@/components/ui/calculator-input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Check, Link2, Wand2 } from "lucide-react";
import { Product } from "@/integrations/supabase/hooks/useProducts";
import { SearchInput } from "@/components/ui/search-input";
import { toast } from "sonner";

export interface ExtractedItem {
  id: string;
  originalDescription: string;
  productCode: string;
  matchedProductId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  total: number;
}

interface ExtractedItemsTableProps {
  items: ExtractedItem[];
  products: Product[];
  onItemUpdate: (id: string, updates: Partial<ExtractedItem>) => void;
  onItemDelete: (id: string) => void;
  onProductMatch: (itemId: string, productId: string | null) => void;
}

export const ExtractedItemsTable = ({
  items,
  products,
  onItemUpdate,
  onItemDelete,
  onProductMatch,
}: ExtractedItemsTableProps) => {
  const [productSearches, setProductSearches] = useState<Record<string, string>>({});

  const handleAutoMatchAll = () => {
    let matchCount = 0;
    items.forEach((item) => {
      if (item.matchedProductId) return; // Already matched
      const descLower = item.description.toLowerCase().trim();
      // Try exact name match first
      let match = products.find(
        (p) => p.name.toLowerCase().trim() === descLower
      );
      // Try partial/fuzzy match
      if (!match) {
        match = products.find(
          (p) =>
            descLower.includes(p.name.toLowerCase().trim()) ||
            p.name.toLowerCase().trim().includes(descLower)
        );
      }
      if (match) {
        onProductMatch(item.id, match.id);
        matchCount++;
      }
    });
    if (matchCount > 0) {
      toast.success(`Auto-matched ${matchCount} item(s) to products`);
    } else {
      toast.info("No matches found. Try matching items manually.");
    }
  };

  const getFilteredProducts = (itemId: string) => {
    const search = productSearches[itemId]?.toLowerCase() || "";
    if (!search) return products.slice(0, 10);
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        p.category?.toLowerCase().includes(search)
    ).slice(0, 20);
  };

  const getMatchedProductName = (productId: string | null) => {
    if (!productId) return null;
    return products.find((p) => p.id === productId)?.name;
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="flex items-center justify-between p-3 bg-muted/50 border-b">
        <span className="text-sm font-medium text-muted-foreground">{items.length} line item(s)</span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAutoMatchAll}
          disabled={items.length === 0 || products.length === 0}
        >
          <Wand2 className="h-4 w-4 mr-1.5" />
          Auto-Match All
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted">
            <TableHead className="w-[350px] py-4 text-base font-semibold">Description</TableHead>
            <TableHead className="w-[220px] py-4 text-base font-semibold">Match Product</TableHead>
            <TableHead className="w-[100px] py-4 text-base font-semibold text-right">Qty</TableHead>
            <TableHead className="w-[120px] py-4 text-base font-semibold text-right">Price</TableHead>
            <TableHead className="w-[90px] py-4 text-base font-semibold">Unit</TableHead>
            <TableHead className="w-[120px] py-4 text-base font-semibold text-right">Total</TableHead>
            <TableHead className="w-[60px] py-4"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow 
              key={item.id} 
              className={index % 2 === 0 ? "bg-background" : "bg-muted/30"}
            >
              <TableCell className="py-4">
                <Input
                  value={item.description}
                  onChange={(e) =>
                    onItemUpdate(item.id, { description: e.target.value })
                  }
                  className="h-11 text-base font-medium"
                />
                {item.productCode && (
                  <span className="text-sm text-muted-foreground mt-2 block font-mono">
                    Code: {item.productCode}
                  </span>
                )}
              </TableCell>
              <TableCell className="py-4">
                <Select
                  value={item.matchedProductId || "none"}
                  onValueChange={(val) =>
                    onProductMatch(item.id, val === "none" ? null : val)
                  }
                >
                  <SelectTrigger className="h-11">
                    <SelectValue>
                      {item.matchedProductId ? (
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <Link2 className="h-4 w-4 text-green-600" />
                          <span className="truncate">
                            {getMatchedProductName(item.matchedProductId)?.slice(0, 18)}
                            {(getMatchedProductName(item.matchedProductId)?.length || 0) > 18 && "..."}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          No match
                        </span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2">
                      <SearchInput
                        placeholder="Search products..."
                        value={productSearches[item.id] || ""}
                        onChange={(val) =>
                          setProductSearches((s) => ({ ...s, [item.id]: val }))
                        }
                        className="mb-2"
                      />
                    </div>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">
                        Keep original (no match)
                      </span>
                    </SelectItem>
                    {getFilteredProducts(item.id).map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        <div className="flex items-center justify-between w-full">
                          <span className="truncate max-w-[150px]">
                            {product.name}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ${product.price.toFixed(2)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="py-4">
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) =>
                    onItemUpdate(item.id, {
                      quantity: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="h-11 text-right text-base font-medium w-24"
                  min={0}
                  step="any"
                />
              </TableCell>
              <TableCell className="py-4">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base">
                    $
                  </span>
                  <CalculatorInput
                    value={item.unitPrice}
                    onValueChange={(value) =>
                      onItemUpdate(item.id, { unitPrice: value })
                    }
                    className="h-11 text-right text-base font-medium pl-7"
                    showCalculatorIcon={false}
                  />
                </div>
              </TableCell>
              <TableCell className="py-4">
                <Input
                  value={item.unit}
                  onChange={(e) =>
                    onItemUpdate(item.id, { unit: e.target.value })
                  }
                  className="h-11 text-base font-medium w-20"
                />
              </TableCell>
              <TableCell className="py-4 text-right">
                <span className="text-base font-semibold">
                  ${item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </TableCell>
              <TableCell className="py-4">
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => onItemDelete(item.id)}
                  className="h-10 w-10"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    {items.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          No items yet. Add line items to get started.
        </div>
      )}
    </div>
  );
};
