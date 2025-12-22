import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProducts } from "@/integrations/supabase/hooks/useProducts";
import { ExtractedItemsTable, ExtractedItem } from "@/components/job-orders/ExtractedItemsTable";

interface ImportDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (items: ExtractedItem[]) => void;
}

export const ImportDocumentDialog = ({
  open,
  onOpenChange,
  onImport,
}: ImportDocumentDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);

  const { data: products } = useProducts();

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setExtractedItems([]);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      setExtractedItems([]);
    }
  }, []);

  const processFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    try {
      // Convert file to base64
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );

      const { data, error } = await supabase.functions.invoke(
        "extract-work-order-items",
        {
          body: { fileBase64: base64, mimeType: file.type },
        }
      );

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Failed to extract items");
      }

      // Map extracted items to our format
      const items: ExtractedItem[] = (data.items || []).map(
        (item: any, index: number) => ({
          id: `extracted-${index}`,
          originalDescription: item.description || "",
          productCode: item.product_code || "",
          matchedProductId: null,
          description: item.description || "",
          quantity: item.quantity || 1,
          unitPrice: item.unit_price || 0,
          unit: item.unit || "EA",
          total: (item.quantity || 1) * (item.unit_price || 0),
        })
      );

      // Try to auto-match products
      if (products) {
        items.forEach((item) => {
          const matchedProduct = products.find(
            (p) =>
              p.name.toLowerCase().includes(item.description.toLowerCase()) ||
              item.description.toLowerCase().includes(p.name.toLowerCase()) ||
              (item.productCode &&
                p.name.toLowerCase().includes(item.productCode.toLowerCase()))
          );
          if (matchedProduct) {
            item.matchedProductId = matchedProduct.id;
            item.unitPrice = item.unitPrice || matchedProduct.price;
            item.unit = item.unit || matchedProduct.unit;
            item.total = item.quantity * item.unitPrice;
          }
        });
      }

      setExtractedItems(items);
      toast.success(`Extracted ${items.length} line items`);
    } catch (error) {
      console.error("Error processing file:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to process document"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleItemUpdate = (id: string, updates: Partial<ExtractedItem>) => {
    setExtractedItems((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
        // Recalculate total
        updated.total = updated.quantity * updated.unitPrice;
        return updated;
      })
    );
  };

  const handleItemDelete = (id: string) => {
    setExtractedItems((items) => items.filter((item) => item.id !== id));
  };

  const handleProductMatch = (itemId: string, productId: string | null) => {
    if (!productId) {
      handleItemUpdate(itemId, { matchedProductId: null });
      return;
    }
    const product = products?.find((p) => p.id === productId);
    if (product) {
      handleItemUpdate(itemId, {
        matchedProductId: productId,
        unitPrice: product.price,
        unit: product.unit,
      });
    }
  };

  const calculateTotals = () => {
    const subtotal = extractedItems.reduce((sum, item) => sum + item.total, 0);
    return { subtotal };
  };

  const handleAddToEstimate = () => {
    if (extractedItems.length === 0) {
      toast.error("No items to add");
      return;
    }

    onImport(extractedItems);
    toast.success(`Added ${extractedItems.length} items to estimate`);
    onOpenChange(false);
  };

  const resetDialog = () => {
    setFile(null);
    setExtractedItems([]);
  };

  const { subtotal } = calculateTotals();

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetDialog();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Document</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload */}
          {!extractedItems.length && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="text-left">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">
                    Drop document here or click to upload
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Supports PDF, PNG, JPG files
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          )}

          {/* Process Button */}
          {file && !extractedItems.length && (
            <Button
              onClick={processFile}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extracting Items...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Extract Line Items
                </>
              )}
            </Button>
          )}

          {/* Extracted Items Table */}
          {extractedItems.length > 0 && (
            <>
              <ExtractedItemsTable
                items={extractedItems}
                products={products || []}
                onItemUpdate={handleItemUpdate}
                onItemDelete={handleItemDelete}
                onProductMatch={handleProductMatch}
              />

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-semibold">Subtotal:</span>
                    <span className="font-bold text-primary">
                      ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddToEstimate}>
                  Add {extractedItems.length} Items to Estimate
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
