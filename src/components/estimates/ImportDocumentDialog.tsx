import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, FileText, X, Image, Clipboard } from "lucide-react";
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
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });

  const { data: products } = useProducts();

  // Handle paste events for screenshots
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const pastedFiles: File[] = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          // Create a named file from the pasted image
          const namedFile = new File(
            [file],
            `pasted-screenshot-${Date.now()}.png`,
            { type: file.type }
          );
          pastedFiles.push(namedFile);
        }
      }
    }

    if (pastedFiles.length > 0) {
      setFiles(prev => [...prev, ...pastedFiles]);
      toast.success(`Pasted ${pastedFiles.length} image${pastedFiles.length > 1 ? 's' : ''}`);
    }
  }, []);

  // Add/remove paste listener when dialog is open and no extracted items yet
  useEffect(() => {
    if (!open || extractedItems.length > 0) return;
    
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [open, extractedItems.length, handlePaste]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      setFiles(prev => [...prev, ...selectedFiles]);
      // Reset input so same file can be selected again
      e.target.value = '';
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
    }
  }, []);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processFiles = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setProcessingProgress({ current: 0, total: files.length });
    
    const allItems: ExtractedItem[] = [];
    let itemIndex = 0;

    try {
      for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
        const file = files[fileIdx];
        setProcessingProgress({ current: fileIdx + 1, total: files.length });

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

        if (error) {
          console.error(`Error processing ${file.name}:`, error);
          toast.error(`Failed to process ${file.name}`);
          continue;
        }

        if (!data.success) {
          console.error(`Failed to extract from ${file.name}:`, data.error);
          toast.error(`Failed to extract from ${file.name}`);
          continue;
        }

        // Map extracted items to our format
        const items: ExtractedItem[] = (data.items || []).map(
          (item: any) => ({
            id: `extracted-${itemIndex++}`,
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

        allItems.push(...items);
      }

      // Try to auto-match products
      if (products && allItems.length > 0) {
        allItems.forEach((item) => {
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

      setExtractedItems(allItems);
      if (allItems.length > 0) {
        toast.success(`Extracted ${allItems.length} line items from ${files.length} file${files.length > 1 ? 's' : ''}`);
      } else {
        toast.error("No items could be extracted from the files");
      }
    } catch (error) {
      console.error("Error processing files:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to process documents"
      );
    } finally {
      setIsProcessing(false);
      setProcessingProgress({ current: 0, total: 0 });
    }
  };

  const handleItemUpdate = (id: string, updates: Partial<ExtractedItem>) => {
    setExtractedItems((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
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
    setFiles([]);
    setExtractedItems([]);
    setProcessingProgress({ current: 0, total: 0 });
  };

  const { subtotal } = calculateTotals();

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="h-5 w-5 text-primary" />;
    }
    return <FileText className="h-5 w-5 text-primary" />;
  };

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const pasteShortcut = isMac ? '⌘V' : 'Ctrl+V';

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
            <>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
              >
                <label className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">
                    Drop files, upload, or paste screenshots
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Supports PDF, PNG, JPG files
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-3 text-sm text-muted-foreground">
                    <Clipboard className="h-4 w-4" />
                    <span>Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">{pasteShortcut}</kbd> to paste from clipboard</span>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {/* File Queue */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Queued Files ({files.length}):
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {files.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {file.type.startsWith('image/') ? (
                            <div className="w-10 h-10 rounded overflow-hidden bg-background flex-shrink-0">
                              <img
                                src={URL.createObjectURL(file)}
                                alt={file.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded bg-background flex items-center justify-center flex-shrink-0">
                              {getFileIcon(file)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(index)}
                          disabled={isProcessing}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Process Button */}
              {files.length > 0 && (
                <Button
                  onClick={processFiles}
                  disabled={isProcessing}
                  className="w-full"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing {processingProgress.current} of {processingProgress.total}...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Extract from {files.length} File{files.length > 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              )}
            </>
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
