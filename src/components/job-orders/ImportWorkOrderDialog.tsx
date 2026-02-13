import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, FileText, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { useProjectsByCustomer } from "@/integrations/supabase/hooks/useProjects";
import { useProducts } from "@/integrations/supabase/hooks/useProducts";
import { useAddJobOrder } from "@/integrations/supabase/hooks/useJobOrders";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { ExtractedItemsTable, ExtractedItem } from "./ExtractedItemsTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ImportWorkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ImportWorkOrderDialog = ({
  open,
  onOpenChange,
}: ImportWorkOrderDialogProps) => {
  const navigate = useNavigate();
  const [entryMode, setEntryMode] = useState<"extract" | "manual">("extract");
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");

  const { data: customers } = useCustomers();
  const { data: projects } = useProjectsByCustomer(customerId || null);
  const { data: products } = useProducts();
  const { data: companySettings } = useCompanySettings();
  const addJobOrder = useAddJobOrder();

  const selectedCustomer = customers?.find((c) => c.id === customerId);
  const selectedProject = projects?.find((p) => p.id === projectId);

  const filteredCustomers = customers?.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.company?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const showItemsTable = entryMode === "manual" || extractedItems.length > 0;

  const handleAddItem = () => {
    const newItem: ExtractedItem = {
      id: `manual-${Date.now()}`,
      originalDescription: "",
      productCode: "",
      matchedProductId: null,
      description: "",
      quantity: 1,
      unitPrice: 0,
      unit: "EA",
      total: 0,
    };
    setExtractedItems((items) => [...items, newItem]);
  };

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
        error instanceof Error ? error.message : "Failed to process work order"
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
    const taxRate = 0; // Labor work orders default to 0% tax
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    return { subtotal, taxRate, taxAmount, total };
  };

  const handleCreateJobOrder = async () => {
    if (!customerId || !projectId) {
      toast.error("Please select a customer and project");
      return;
    }

    if (extractedItems.length === 0) {
      toast.error("No items to create job order");
      return;
    }

    const { subtotal, taxRate, taxAmount, total } = calculateTotals();

    const lineItems = extractedItems.map((item) => {
      const product = products?.find(p => p.id === item.matchedProductId);
      return {
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        markup: 0,
        total: item.total,
        product_id: item.matchedProductId || undefined,
        product_name: product?.name,
      };
    });

    try {
      const result = await addJobOrder.mutateAsync({
        jobOrder: {
          number: "", // Auto-generated by database trigger
          estimate_id: null, // No estimate for imported work orders
          customer_id: customerId,
          customer_name: selectedCustomer?.name || "",
          project_id: projectId,
          project_name: selectedProject?.name || "",
          status: "active",
          start_date: new Date().toISOString().split("T")[0],
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total,
          invoiced_amount: 0,
          remaining_amount: total,
        },
        lineItems,
      });

      toast.success("Job order created successfully");
      onOpenChange(false);
      navigate(`/job-orders/${result.id}`);
    } catch (error) {
      console.error("Error creating job order:", error);
      toast.error("Failed to create job order");
    }
  };

  const resetDialog = () => {
    setEntryMode("extract");
    setFile(null);
    setExtractedItems([]);
    setCustomerId("");
    setProjectId("");
    setCustomerSearch("");
  };

  const { subtotal, taxRate, taxAmount, total } = calculateTotals();

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
          <DialogTitle>Import Work Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Entry Mode Toggle */}
          <Tabs value={entryMode} onValueChange={(v) => setEntryMode(v as "extract" | "manual")}>
            <TabsList className="w-full">
              <TabsTrigger value="extract" className="flex-1 gap-2">
                <FileText className="h-4 w-4" />
                Extract from Document
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex-1 gap-2">
                <Plus className="h-4 w-4" />
                Manual Entry
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* File Upload -- only in extract mode when no items yet */}
          {entryMode === "extract" && !extractedItems.length && (
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
                    Drop work order PDF here or click to upload
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

          {/* Process Button -- only in extract mode */}
          {entryMode === "extract" && file && !extractedItems.length && (
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

          {/* Customer & Project Selection -- visible when items table is shown */}
          {showItemsTable && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Select value={customerId} onValueChange={(val) => {
                    setCustomerId(val);
                    setProjectId("");
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="p-2">
                        <SearchInput
                          placeholder="Search customers..."
                          value={customerSearch}
                          onChange={setCustomerSearch}
                          className="mb-2"
                        />
                      </div>
                      {filteredCustomers?.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                          {customer.company && ` - ${customer.company}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Project</Label>
                  <Select
                    value={projectId}
                    onValueChange={setProjectId}
                    disabled={!customerId}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          customerId ? "Select project" : "Select customer first"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {projects?.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Items Table */}
              <ExtractedItemsTable
                items={extractedItems}
                products={products || []}
                onItemUpdate={handleItemUpdate}
                onItemDelete={handleItemDelete}
                onProductMatch={handleProductMatch}
              />

              {/* Add Line Item Button */}
              <Button
                variant="outline"
                onClick={handleAddItem}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Line Item
              </Button>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">
                      ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Tax ({taxRate}%):
                    </span>
                    <span className="font-medium">
                      ${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-semibold">Total:</span>
                    <span className="font-bold text-primary">
                      ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateJobOrder}
                  disabled={!customerId || !projectId || extractedItems.length === 0 || addJobOrder.isPending}
                >
                  {addJobOrder.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Job Order"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
