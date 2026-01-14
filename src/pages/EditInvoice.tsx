import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, AlertTriangle, ArrowLeft, Eye, ChevronUp, ChevronDown, Trash2, GripVertical } from "lucide-react";
import { InlineProductDialog } from "@/components/products/InlineProductDialog";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { useProducts } from "@/integrations/supabase/hooks/useProducts";
import { useInvoice, useUpdateInvoice } from "@/integrations/supabase/hooks/useInvoices";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(2000),
  quantity: z.number().min(0, "Quantity cannot be negative"),
  unit_price: z.number(),
});

const invoiceSchema = z.object({
  customer_id: z.string().uuid("Please select a customer"),
  tax_rate: z.number().min(0).max(100),
  due_date: z.string().min(1, "Due date is required"),
  notes: z.string().max(2000).optional(),
});

interface LineItem {
  id: string;
  product_id?: string;
  product_name?: string;
  description: string;
  quantity: string;
  unit_price: string;
  markup: string;
  total: number;
  isExpanded?: boolean;
}

// Sortable Line Item Component
const SortableLineItem = ({
  item,
  index,
  products,
  onUpdate,
  onRemove,
  onSelectProduct,
  onToggleExpand,
  canRemove,
}: {
  item: LineItem;
  index: number;
  products: any[];
  onUpdate: (index: number, field: keyof LineItem, value: string) => void;
  onRemove: (index: number) => void;
  onSelectProduct: (index: number, productId: string) => void;
  onToggleExpand: (index: number) => void;
  canRemove: boolean;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="glass rounded-lg p-4 mb-3 border border-border/50"
    >
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          className="cursor-grab hover:bg-muted rounded p-1"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <span className="text-sm font-medium text-muted-foreground">
          Line {index + 1}
        </span>
        <div className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onToggleExpand(index)}
        >
          {item.isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => onRemove(index)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {item.isExpanded ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <Label>Product (Optional)</Label>
            <Select
              value={item.product_id || "none"}
              onValueChange={(value) => onSelectProduct(index, value === "none" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a product..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No product</SelectItem>
                {products?.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} - {formatCurrency(product.price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Description *</Label>
            <Input
              value={item.description}
              onChange={(e) => onUpdate(index, "description", e.target.value)}
              placeholder="Enter description"
            />
          </div>
          <div>
            <Label>Quantity *</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={item.quantity}
              onChange={(e) => onUpdate(index, "quantity", e.target.value)}
            />
          </div>
          <div>
            <Label>Unit Price *</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={item.unit_price}
              onChange={(e) => onUpdate(index, "unit_price", e.target.value)}
            />
          </div>
          <div>
            <Label>Markup %</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={item.markup}
              onChange={(e) => onUpdate(index, "markup", e.target.value)}
            />
          </div>
          <div>
            <Label>Line Total</Label>
            <div className="h-10 flex items-center font-semibold">
              {formatCurrency(item.total)}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <span className="font-medium">{item.product_name || item.description || "No description"}</span>
            {item.product_name && item.description && (
              <span className="text-muted-foreground ml-2">- {item.description}</span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span>{item.quantity} × {formatCurrency(parseFloat(item.unit_price) || 0)}</span>
            <span className="font-semibold">{formatCurrency(item.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const EditInvoice = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: invoice, isLoading: invoiceLoading } = useInvoice(id || "");
  const { data: customers, isLoading: customersLoading } = useCustomers();
  const { data: projects } = useProjects();
  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: companySettings } = useCompanySettings();
  const updateInvoice = useUpdateInvoice();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [taxRate, setTaxRate] = useState<string>("8.25");
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [customerPo, setCustomerPo] = useState<string>("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [createProductDialogOpen, setCreateProductDialogOpen] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [recoveredDraft, setRecoveredDraft] = useState<any>(null);

  // Track initial state for unsaved changes detection
  const initialStateRef = useRef<{
    customerId: string;
    projectId: string;
    taxRate: string;
    dueDate: string;
    notes: string;
    customerPo: string;
    lineItems: string;
  } | null>(null);

  // Initialize form with invoice data
  useEffect(() => {
    if (invoice && !isInitialized) {
      // Prevent editing fully paid invoices
      if (invoice.status === "paid") {
        toast({
          title: "Cannot Edit",
          description: "Fully paid invoices cannot be edited.",
          variant: "destructive",
        });
        navigate(`/invoices/${id}`);
        return;
      }

      setSelectedCustomerId(invoice.customer_id);
      setSelectedProjectId(invoice.project_id || "");
      setTaxRate(invoice.tax_rate.toString());
      setDueDate(invoice.due_date);
      setNotes(invoice.notes || "");
      setCustomerPo((invoice as any).customer_po || "");
      
      // Convert line items to form format
      const formLineItems = invoice.line_items.map((item) => ({
        id: item.id,
        product_id: item.product_id || undefined,
        product_name: item.product_name || undefined,
        description: item.description,
        quantity: item.quantity.toString(),
        unit_price: item.unit_price.toString(),
        markup: item.markup.toString(),
        total: item.total,
        isExpanded: false,
      }));
      
      setLineItems(formLineItems.length > 0 ? formLineItems : [
        { id: crypto.randomUUID(), description: "", quantity: "1", unit_price: "", markup: "0", total: 0, isExpanded: true },
      ]);
      
      setIsInitialized(true);
    }
  }, [invoice, isInitialized, id, navigate]);

  // Set initial state after form is initialized
  useEffect(() => {
    if (isInitialized && !initialStateRef.current && lineItems.length > 0) {
      initialStateRef.current = {
        customerId: selectedCustomerId,
        projectId: selectedProjectId,
        taxRate,
        dueDate,
        notes,
        customerPo,
        lineItems: JSON.stringify(lineItems),
      };
    }
  }, [isInitialized, selectedCustomerId, selectedProjectId, taxRate, dueDate, notes, customerPo, lineItems]);

  // Check for recovered draft on mount
  useEffect(() => {
    if (!id) return;
    
    const draftKey = `invoice_edit_draft:${id}`;
    const savedDraft = localStorage.getItem(draftKey);
    
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed.lineItems && parsed.lineItems.length > 0) {
          setRecoveredDraft(parsed);
          setShowRecoveryDialog(true);
        }
      } catch (e) {
        console.error("Failed to parse saved draft:", e);
        localStorage.removeItem(draftKey);
      }
    }
  }, [id]);

  // Calculate if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!initialStateRef.current) return false;
    
    const currentState = {
      customerId: selectedCustomerId,
      projectId: selectedProjectId,
      taxRate,
      dueDate,
      notes,
      customerPo,
      lineItems: JSON.stringify(lineItems),
    };
    
    return (
      currentState.customerId !== initialStateRef.current.customerId ||
      currentState.projectId !== initialStateRef.current.projectId ||
      currentState.taxRate !== initialStateRef.current.taxRate ||
      currentState.dueDate !== initialStateRef.current.dueDate ||
      currentState.notes !== initialStateRef.current.notes ||
      currentState.customerPo !== initialStateRef.current.customerPo ||
      currentState.lineItems !== initialStateRef.current.lineItems
    );
  }, [selectedCustomerId, selectedProjectId, taxRate, dueDate, notes, customerPo, lineItems]);

  // Autosave to localStorage
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (!isInitialized || !id || !hasUnsavedChanges) return;
    
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }
    
    autosaveTimeoutRef.current = setTimeout(() => {
      const draft = {
        customerId: selectedCustomerId,
        projectId: selectedProjectId,
        taxRate,
        dueDate,
        notes,
        customerPo,
        lineItems,
      };
      localStorage.setItem(`invoice_edit_draft:${id}`, JSON.stringify(draft));
    }, 1000);
    
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [isInitialized, id, hasUnsavedChanges, selectedCustomerId, selectedProjectId, taxRate, dueDate, notes, customerPo, lineItems]);

  // Recovery handlers
  const handleRestoreDraft = useCallback(() => {
    if (recoveredDraft) {
      setSelectedCustomerId(recoveredDraft.customerId);
      setSelectedProjectId(recoveredDraft.projectId);
      setTaxRate(recoveredDraft.taxRate);
      setDueDate(recoveredDraft.dueDate);
      setNotes(recoveredDraft.notes);
      setCustomerPo(recoveredDraft.customerPo || "");
      setLineItems(recoveredDraft.lineItems);
    }
    setShowRecoveryDialog(false);
    setRecoveredDraft(null);
  }, [recoveredDraft]);

  const handleDiscardDraft = useCallback(() => {
    if (id) {
      localStorage.removeItem(`invoice_edit_draft:${id}`);
    }
    setShowRecoveryDialog(false);
    setRecoveredDraft(null);
  }, [id]);

  // Unsaved changes warning hook
  const {
    showLeaveDialog,
    confirmLeave,
    cancelLeave,
    handleCancelClick,
  } = useUnsavedChangesWarning({
    hasUnsavedChanges,
    enabled: isInitialized,
  });

  const calculateLineItemTotal = (quantity: string, unitPrice: string, markup: string) => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    const mkup = parseFloat(markup) || 0;
    return qty * price * (1 + mkup / 100);
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
    const newLineItems = [...lineItems];
    newLineItems[index] = { ...newLineItems[index], [field]: value };

    if (field === "quantity" || field === "unit_price" || field === "markup") {
      newLineItems[index].total = calculateLineItemTotal(
        newLineItems[index].quantity,
        newLineItems[index].unit_price,
        newLineItems[index].markup
      );
    }

    setLineItems(newLineItems);
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: crypto.randomUUID(), description: "", quantity: "1", unit_price: "", markup: "0", total: 0, isExpanded: true },
    ]);
  };

  const toggleAllExpanded = () => {
    const newExpanded = !allExpanded;
    setAllExpanded(newExpanded);
    setLineItems(prev => prev.map(item => ({ ...item, isExpanded: newExpanded })));
  };

  const toggleItemExpanded = (index: number) => {
    const newLineItems = [...lineItems];
    newLineItems[index] = { ...newLineItems[index], isExpanded: !newLineItems[index].isExpanded };
    setLineItems(newLineItems);
  };

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLineItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const selectProduct = (index: number, productId: string) => {
    const product = products?.find((p) => p.id === productId);
    if (product) {
      const newLineItems = [...lineItems];
      const quantity = newLineItems[index].quantity;
      const unitPrice = product.price.toString();
      const markup = product.markup.toString();
      
      newLineItems[index] = {
        ...newLineItems[index],
        product_id: productId,
        product_name: product.name,
        description: product.description || "",
        unit_price: unitPrice,
        markup: markup,
        total: calculateLineItemTotal(quantity, unitPrice, markup),
      };
      
      setLineItems(newLineItems);
    }
  };

  const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);
  const isCustomerTaxExempt = selectedCustomer?.tax_exempt ?? false;

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const effectiveTaxRate = isCustomerTaxExempt ? 0 : (parseFloat(taxRate) || 0);
  const taxAmount = subtotal * effectiveTaxRate / 100;
  const total = subtotal + taxAmount;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    try {
      invoiceSchema.parse({
        customer_id: selectedCustomerId,
        tax_rate: parseFloat(taxRate),
        due_date: dueDate,
        notes,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => {
          newErrors[err.path[0]] = err.message;
        });
      }
    }

    lineItems.forEach((item, index) => {
      try {
        lineItemSchema.parse({
          description: item.description,
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price),
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          error.errors.forEach((err) => {
            newErrors[`line_${index}_${err.path[0]}`] = err.message;
          });
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !id) return;

    const selectedProject = projects?.find(p => p.id === selectedProjectId);
    const customer = customers?.find(c => c.id === selectedCustomerId);

    const invoiceData = {
      customer_id: selectedCustomerId,
      customer_name: customer?.company || customer?.name || "",
      project_id: selectedProjectId || null,
      project_name: selectedProject?.name || null,
      subtotal,
      tax_rate: effectiveTaxRate,
      tax_amount: taxAmount,
      total,
      due_date: dueDate,
      notes: notes || null,
      customer_po: customerPo || null,
      line_items: lineItems.map((item, index) => ({
        id: item.id,
        invoice_id: id,
        product_id: item.product_id || null,
        product_name: item.product_name || null,
        description: item.description,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
        markup: parseFloat(item.markup) || 0,
        total: item.total,
        display_order: index,
      })),
    };

    updateInvoice.mutate(
      { id, invoice: invoiceData },
      {
        onSuccess: () => {
          // Clear the draft
          localStorage.removeItem(`invoice_edit_draft:${id}`);
          // Reset initial state to current state
          initialStateRef.current = {
            customerId: selectedCustomerId,
            projectId: selectedProjectId,
            taxRate,
            dueDate,
            notes,
            customerPo,
            lineItems: JSON.stringify(lineItems),
          };
          navigate(`/invoices/${id}`);
        },
      }
    );
  };

  if (invoiceLoading || customersLoading || productsLoading) {
    return (
      <PageLayout title="Loading..." description="">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  if (!invoice) {
    return (
      <PageLayout title="Invoice Not Found" description="">
        <Button variant="ghost" onClick={() => navigate("/invoices")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Invoices
        </Button>
      </PageLayout>
    );
  }

  const filteredProjects = selectedCustomerId
    ? projects?.filter(p => p.customer_id === selectedCustomerId)
    : projects;

  return (
    <PageLayout
      title={`Edit Invoice ${invoice.number}`}
      description="Modify invoice details and line items"
      actions={
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate(`/invoices/${id}`)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateInvoice.isPending}>
            {updateInvoice.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      }
    >
      <Button
        variant="ghost"
        className="mb-6"
        onClick={() => navigate(`/invoices/${id}`)}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Invoice
      </Button>

      <div className="space-y-6 max-w-5xl">
        {/* Invoice Info */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Customer *</Label>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger className={errors.customer_id ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.company || customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.customer_id && (
                  <p className="text-sm text-destructive mt-1">{errors.customer_id}</p>
                )}
              </div>
              <div>
                <Label>Project (Optional)</Label>
                <Select 
                  value={selectedProjectId || "none"} 
                  onValueChange={(value) => setSelectedProjectId(value === "none" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Project</SelectItem>
                    {filteredProjects?.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Due Date *</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={errors.due_date ? "border-destructive" : ""}
                />
                {errors.due_date && (
                  <p className="text-sm text-destructive mt-1">{errors.due_date}</p>
                )}
              </div>
              <div>
                <Label>Tax Rate (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  disabled={isCustomerTaxExempt}
                />
                {isCustomerTaxExempt && (
                  <p className="text-sm text-muted-foreground mt-1">Customer is tax exempt</p>
                )}
              </div>
              <div>
                <Label>Customer PO #</Label>
                <Input
                  value={customerPo}
                  onChange={(e) => setCustomerPo(e.target.value)}
                  placeholder="Customer PO number"
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={toggleAllExpanded}>
                {allExpanded ? "Collapse All" : "Expand All"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCreateProductDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                New Product
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={lineItems.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                {lineItems.map((item, index) => (
                  <SortableLineItem
                    key={item.id}
                    item={item}
                    index={index}
                    products={products || []}
                    onUpdate={updateLineItem}
                    onRemove={removeLineItem}
                    onSelectProduct={selectProduct}
                    onToggleExpand={toggleItemExpanded}
                    canRemove={lineItems.length > 1}
                  />
                ))}
              </SortableContext>
            </DndContext>

            <Button variant="outline" onClick={addLineItem} className="w-full mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Add Line Item
            </Button>
          </CardContent>
        </Card>

        {/* Totals */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax ({effectiveTaxRate}%)</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Product Dialog */}
      <InlineProductDialog
        open={createProductDialogOpen}
        onOpenChange={setCreateProductDialogOpen}
      />

      {/* Draft Recovery Dialog */}
      <AlertDialog open={showRecoveryDialog} onOpenChange={setShowRecoveryDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Recover Unsaved Changes?
            </AlertDialogTitle>
            <AlertDialogDescription>
              We found unsaved changes from a previous session. Would you like to restore them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardDraft}>
              Discard
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreDraft}>
              Restore Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={cancelLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to leave? Your changes will be saved as a draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelLeave}>
              Stay
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmLeave}>
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
};

export default EditInvoice;
