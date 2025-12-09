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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Check, Link2 } from "lucide-react";
import { Product } from "@/integrations/supabase/hooks/useProducts";
import { SearchInput } from "@/components/ui/search-input";

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
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[300px]">Description</TableHead>
            <TableHead className="w-[200px]">Match Product</TableHead>
            <TableHead className="w-[80px] text-right">Qty</TableHead>
            <TableHead className="w-[100px] text-right">Price</TableHead>
            <TableHead className="w-[70px]">Unit</TableHead>
            <TableHead className="w-[100px] text-right">Total</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <Input
                  value={item.description}
                  onChange={(e) =>
                    onItemUpdate(item.id, { description: e.target.value })
                  }
                  className="text-sm"
                />
                {item.productCode && (
                  <span className="text-xs text-muted-foreground mt-1 block">
                    Code: {item.productCode}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Select
                  value={item.matchedProductId || "none"}
                  onValueChange={(val) =>
                    onProductMatch(item.id, val === "none" ? null : val)
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue>
                      {item.matchedProductId ? (
                        <span className="flex items-center gap-1 text-xs">
                          <Link2 className="h-3 w-3 text-success" />
                          {getMatchedProductName(item.matchedProductId)?.slice(0, 20)}
                          {(getMatchedProductName(item.matchedProductId)?.length || 0) > 20 && "..."}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">
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
              <TableCell>
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) =>
                    onItemUpdate(item.id, {
                      quantity: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="text-right text-sm w-20"
                  min={0}
                  step="any"
                />
              </TableCell>
              <TableCell>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    $
                  </span>
                  <Input
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) =>
                      onItemUpdate(item.id, {
                        unitPrice: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="text-right text-sm pl-6"
                    min={0}
                    step="0.01"
                  />
                </div>
              </TableCell>
              <TableCell>
                <Input
                  value={item.unit}
                  onChange={(e) =>
                    onItemUpdate(item.id, { unit: e.target.value })
                  }
                  className="text-sm w-16"
                />
              </TableCell>
              <TableCell className="text-right font-medium">
                ${item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onItemDelete(item.id)}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {items.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          No items extracted. Upload a work order to get started.
        </div>
      )}
    </div>
  );
};
