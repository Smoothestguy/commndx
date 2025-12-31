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
import { Plus, Loader2, AlertTriangle, ArrowLeft, Edit, Eye, Upload, ChevronUp, ChevronDown } from "lucide-react";
import { ImportDocumentDialog } from "@/components/estimates/ImportDocumentDialog";
import { InlineProductDialog } from "@/components/products/InlineProductDialog";
import { ExtractedItem } from "@/components/job-orders/ExtractedItemsTable";
import { EstimatePreviewDialog } from "@/components/estimates/EstimatePreviewDialog";
import { SortableLineItem } from "@/components/estimates/SortableLineItem";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { useProjectsByCustomer } from "@/integrations/supabase/hooks/useProjects";
import { useProducts } from "@/integrations/supabase/hooks/useProducts";
import { useEstimate, useUpdateEstimate } from "@/integrations/supabase/hooks/useEstimates";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { useCreateEstimateVersion } from "@/integrations/supabase/hooks/useEstimateVersions";
import { z } from "zod";
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
} from "@dnd-kit/sortable";

const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(2000),
  quantity: z.number().min(0, "Quantity cannot be negative"),
  unit_price: z.number(),
  margin: z.number().min(0, "Margin cannot be negative").max(99.99, "Margin must be less than 100%"),
});

const estimateSchema = z.object({
  customer_id: z.string().uuid("Please select a customer"),
  tax_rate: z.number().min(0).max(100),
  valid_until: z.string().min(1, "Valid until date is required"),
  notes: z.string().max(1000).optional(),
});

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
  isExpanded?: boolean;
}

const EditEstimate = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: estimate, isLoading: estimateLoading } = useEstimate(id || "");
  const { data: customers, isLoading: customersLoading } = useCustomers();
  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: companySettings } = useCompanySettings();
  const updateEstimate = useUpdateEstimate();
  const createVersion = useCreateEstimateVersion();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [taxRate, setTaxRate] = useState<string>("8.25");
  const [validUntil, setValidUntil] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [status, setStatus] = useState<"draft" | "pending" | "sent" | "approved" | "closed">("draft");
  const [defaultPricingType, setDefaultPricingType] = useState<'markup' | 'margin'>('margin');
  const [defaultMarginPercent, setDefaultMarginPercent] = useState<string>("30");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [createProductDialogOpen, setCreateProductDialogOpen] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);
  const [productComboboxStates, setProductComboboxStates] = useState<Record<number, boolean>>({});
  const [productSearchStates, setProductSearchStates] = useState<Record<number, string>>({});
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [recoveredDraft, setRecoveredDraft] = useState<{
    customerId: string;
    projectId: string;
    taxRate: string;
    validUntil: string;
    notes: string;
    status: string;
    lineItems: LineItem[];
  } | null>(null);

  const { data: projects } = useProjectsByCustomer(selectedCustomerId);

  // Track initial state for unsaved changes detection
  const initialStateRef = useRef<{
    customerId: string;
    projectId: string;
    taxRate: string;
    validUntil: string;
    notes: string;
    status: string;
    lineItems: string;
  } | null>(null);

  // Initialize form with estimate data
  useEffect(() => {
    if (estimate && !isInitialized) {
      setSelectedCustomerId(estimate.customer_id);
      setSelectedProjectId(estimate.project_id || "");
      setTaxRate(estimate.tax_rate.toString());
      setValidUntil(estimate.valid_until);
      setNotes(estimate.notes || "");
      setStatus(estimate.status);
      setDefaultPricingType(estimate.default_pricing_type || 'margin');
      
      // Convert line items to form format - collapsed by default
      const formLineItems = estimate.line_items.map((item) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: (item as any).product_name || undefined,
        description: item.description,
        quantity: item.quantity.toString(),
        unit_price: item.unit_price.toString(),
        margin: item.markup.toString(),
        pricing_type: (item.pricing_type || 'margin') as 'markup' | 'margin',
        is_taxable: item.is_taxable ?? true,
        total: item.total,
        isExpanded: false, // Collapsed by default when editing
      }));
      
      // Set the default margin from the first line item (if it has one)
      if (formLineItems.length > 0 && formLineItems[0].margin) {
        setDefaultMarginPercent(formLineItems[0].margin);
      }
      
      setLineItems(formLineItems.length > 0 ? formLineItems : [
        { id: crypto.randomUUID(), description: "", quantity: "1", unit_price: "", margin: "0", pricing_type: "margin", is_taxable: true, total: 0, isExpanded: true },
      ]);
      
      setIsInitialized(true);
    }
  }, [estimate, isInitialized]);

  // Set initial state after form is initialized
  useEffect(() => {
    if (isInitialized && !initialStateRef.current && lineItems.length > 0) {
      initialStateRef.current = {
        customerId: selectedCustomerId,
        projectId: selectedProjectId,
        taxRate,
        validUntil,
        notes,
        status,
        lineItems: JSON.stringify(lineItems),
      };
    }
  }, [isInitialized, selectedCustomerId, selectedProjectId, taxRate, validUntil, notes, status, lineItems]);

  // Check for recovered draft on mount
  useEffect(() => {
    if (!id) return;
    
    const draftKey = `estimate_edit_draft:${id}`;
    const savedDraft = localStorage.getItem(draftKey);
    
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        // Only show recovery if the draft has actual content
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
      validUntil,
      notes,
      status,
      lineItems: JSON.stringify(lineItems),
    };
    
    return (
      currentState.customerId !== initialStateRef.current.customerId ||
      currentState.projectId !== initialStateRef.current.projectId ||
      currentState.taxRate !== initialStateRef.current.taxRate ||
      currentState.validUntil !== initialStateRef.current.validUntil ||
      currentState.notes !== initialStateRef.current.notes ||
      currentState.status !== initialStateRef.current.status ||
      currentState.lineItems !== initialStateRef.current.lineItems
    );
  }, [selectedCustomerId, selectedProjectId, taxRate, validUntil, notes, status, lineItems]);

  // Autosave to localStorage (debounced) - must be after hasUnsavedChanges is defined
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (!isInitialized || !id || !hasUnsavedChanges) return;
    
    // Clear existing timeout
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }
    
    // Debounce save by 1 second
    autosaveTimeoutRef.current = setTimeout(() => {
      const draft = {
        customerId: selectedCustomerId,
        projectId: selectedProjectId,
        taxRate,
        validUntil,
        notes,
        status,
        lineItems,
      };
      localStorage.setItem(`estimate_edit_draft:${id}`, JSON.stringify(draft));
    }, 1000);
    
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [isInitialized, id, hasUnsavedChanges, selectedCustomerId, selectedProjectId, taxRate, validUntil, notes, status, lineItems]);

  // Recovery handlers
  const handleRestoreDraft = useCallback(() => {
    if (recoveredDraft) {
      setSelectedCustomerId(recoveredDraft.customerId);
      setSelectedProjectId(recoveredDraft.projectId);
      setTaxRate(recoveredDraft.taxRate);
      setValidUntil(recoveredDraft.validUntil);
      setNotes(recoveredDraft.notes);
      setStatus(recoveredDraft.status as "draft" | "pending" | "sent" | "approved");
      setLineItems(recoveredDraft.lineItems);
    }
    setShowRecoveryDialog(false);
    setRecoveredDraft(null);
  }, [recoveredDraft]);

  const handleDiscardDraft = useCallback(() => {
    if (id) {
      localStorage.removeItem(`estimate_edit_draft:${id}`);
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

  const calculateLineItemTotal = (quantity: string, unitPrice: string, percentage: string, pricingType: 'markup' | 'margin') => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    const pct = parseFloat(percentage) || 0;
    
    if (pricingType === 'markup') {
      return qty * price * (1 + pct / 100);
    } else {
      return pct > 0 && pct < 100 ? qty * price / (1 - pct / 100) : qty * price;
    }
  };

  // Auto-apply margin/markup changes to all line items
  useEffect(() => {
    if (isInitialized && lineItems.length > 0) {
      const newLineItems = lineItems.map(item => {
        const newTotal = calculateLineItemTotal(
          item.quantity, item.unit_price, defaultMarginPercent, defaultPricingType
        );
        return { ...item, margin: defaultMarginPercent, pricing_type: defaultPricingType, total: newTotal };
      });
      setLineItems(newLineItems);
    }
  }, [defaultMarginPercent, defaultPricingType]);

  const updateLineItem = (index: number, field: keyof LineItem, value: string | boolean) => {
    const newLineItems = [...lineItems];
    
    if (field === "is_taxable") {
      newLineItems[index] = { ...newLineItems[index], [field]: value === "true" || value === true };
    } else {
      newLineItems[index] = { ...newLineItems[index], [field]: value };
    }

    if (field === "quantity" || field === "unit_price" || field === "margin" || field === "pricing_type") {
      newLineItems[index].total = calculateLineItemTotal(
        newLineItems[index].quantity,
        newLineItems[index].unit_price,
        newLineItems[index].margin,
        newLineItems[index].pricing_type
      );
    }

    setLineItems(newLineItems);
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: crypto.randomUUID(), description: "", quantity: "1", unit_price: "", margin: "0", pricing_type: defaultPricingType, is_taxable: true, total: 0, isExpanded: true },
    ]);
  };

  // Handle imported items from document
  const handleImportedItems = (items: ExtractedItem[]) => {
    const newLineItems = items.map(item => ({
      id: crypto.randomUUID(),
      product_id: item.matchedProductId || undefined,
      description: item.description,
      quantity: item.quantity.toString(),
      unit_price: item.unitPrice.toString(),
      margin: defaultMarginPercent,
      pricing_type: defaultPricingType,
      is_taxable: true,
      total: calculateLineItemTotal(
        item.quantity.toString(),
        item.unitPrice.toString(),
        defaultMarginPercent,
        defaultPricingType
      ),
      isExpanded: false,
    }));
    setLineItems(prev => [...prev, ...newLineItems]);
  };

  // Toggle all line items expand/collapse
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

  // Product combobox handlers
  const handleSetProductComboboxOpen = (index: number, open: boolean) => {
    setProductComboboxStates((prev) => ({ ...prev, [index]: open }));
  };

  const handleSetProductSearch = (index: number, value: string) => {
    setProductSearchStates((prev) => ({ ...prev, [index]: value }));
  };

  // Get products by type for combobox
  const getProductsByType = (type: 'product' | 'service' | 'labor') => {
    return (products || []).filter((p) => p.item_type === type);
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
      const margin = product.markup.toString();
      const pricingType = newLineItems[index].pricing_type;
      
      newLineItems[index] = {
        ...newLineItems[index],
        product_id: productId,
        product_name: product.name,
        description: product.description || "",
        unit_price: unitPrice,
        margin: margin,
        is_taxable: product.is_taxable ?? true,
        total: calculateLineItemTotal(quantity, unitPrice, margin, pricingType),
      };
      
      setLineItems(newLineItems);
    }
  };

  const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);
  const isCustomerTaxExempt = selectedCustomer?.tax_exempt ?? false;

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxableSubtotal = lineItems.filter(item => item.is_taxable).reduce((sum, item) => sum + item.total, 0);
  const effectiveTaxRate = isCustomerTaxExempt ? 0 : (parseFloat(taxRate) || 0);
  const taxAmount = taxableSubtotal * effectiveTaxRate / 100;
  const total = subtotal + taxAmount;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    try {
      estimateSchema.parse({
        customer_id: selectedCustomerId,
        tax_rate: parseFloat(taxRate),
        valid_until: validUntil,
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
          margin: parseFloat(item.margin),
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !id) {
      return;
    }

    const customer = customers?.find((c) => c.id === selectedCustomerId);
    const project = projects?.find((p) => p.id === selectedProjectId);

    if (!customer) return;

    // Save current version before updating (non-blocking)
    if (estimate) {
      try {
        await createVersion.mutateAsync({
          estimateId: id,
          snapshot: {
            customer_id: estimate.customer_id,
            customer_name: estimate.customer_name,
            project_id: estimate.project_id,
            project_name: estimate.project_name,
            status: estimate.status,
            subtotal: estimate.subtotal,
            tax_rate: estimate.tax_rate,
            tax_amount: estimate.tax_amount,
            total: estimate.total,
            notes: estimate.notes,
            valid_until: estimate.valid_until,
            default_pricing_type: estimate.default_pricing_type,
            line_items: estimate.line_items.map((item) => ({
              product_id: item.product_id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              markup: item.markup,
              pricing_type: item.pricing_type,
              is_taxable: item.is_taxable ?? true,
              total: item.total,
            })),
          },
          changeSummary: "Saved before editing",
        });
      } catch (versionError) {
        console.error("Failed to create version snapshot:", versionError);
        // Continue with save anyway - version history is non-critical
      }
    }

    const estimateData = {
      id,
      estimate: {
        customer_id: selectedCustomerId,
        customer_name: customer.name,
        project_id: selectedProjectId || null,
        project_name: project?.name || null,
        status,
        subtotal,
        tax_rate: effectiveTaxRate,
        tax_amount: taxAmount,
        total,
        notes: notes || null,
        valid_until: validUntil,
        default_pricing_type: defaultPricingType,
      },
      lineItems: lineItems.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        description: item.description,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
        markup: parseFloat(item.margin),
        pricing_type: item.pricing_type,
        is_taxable: item.is_taxable,
        total: item.total,
      })),
    };

    updateEstimate.mutate(estimateData, {
      onSuccess: () => {
        // Reset initial state to match saved data - allows repeat saves without refresh
        initialStateRef.current = {
          customerId: selectedCustomerId,
          projectId: selectedProjectId,
          taxRate,
          validUntil,
          notes,
          status,
          lineItems: JSON.stringify(lineItems),
        };
        // Clear any local draft
        localStorage.removeItem(`estimate_edit_draft:${id}`);
        navigate(`/estimates/${id}`);
      },
    });
  };

  // Handle cancel with unsaved changes check
  const handleCancel = () => {
    const shouldProceed = handleCancelClick();
    if (shouldProceed) {
      navigate(`/estimates/${id}`);
    }
  };

  // Handle confirm leave from dialog
  const handleConfirmLeave = () => {
    confirmLeave();
    navigate(`/estimates/${id}`);
  };

  if (estimateLoading || customersLoading || productsLoading) {
    return (
      <PageLayout title="Edit Estimate" description="Loading...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  if (!estimate) {
    return (
      <PageLayout title="Error" description="Estimate not found">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">Estimate not found</p>
            <div className="flex justify-center mt-4">
              <Button onClick={() => navigate("/estimates")}>Back to Estimates</Button>
            </div>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={
        <div className="flex items-center gap-3">
          <span>Edit {estimate.number}</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Edit className="h-3 w-3" />
            Editing
          </span>
        </div>
      }
      description="Update estimate details"
      actions={
        <Button variant="outline" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Details
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer & Project Selection */}
        <Card className="glass border-border">
          <CardHeader>
            <CardTitle className="font-heading">Customer & Project</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customer">Customer *</Label>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.company || customer.name}
                        {customer.company && customer.name && customer.company !== customer.name && (
                          <span className="text-muted-foreground ml-1">({customer.name})</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.customer_id && (
                  <p className="text-sm text-destructive">{errors.customer_id}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="project">Project (Optional)</Label>
                <Select
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                  disabled={!selectedCustomerId}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Select project" />
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

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultPricingType">Pricing Method</Label>
                <Select value={defaultPricingType} onValueChange={(v: 'markup' | 'margin') => setDefaultPricingType(v)}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="margin">Margin-based</SelectItem>
                    <SelectItem value="markup">Markup-based</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultMarginPercent">{defaultPricingType === 'margin' ? 'Margin' : 'Markup'} (%)</Label>
                <Input
                  id="defaultMarginPercent"
                  type="number"
                  step="0.01"
                  min="0"
                  max={defaultPricingType === 'margin' ? "99.99" : undefined}
                  value={defaultMarginPercent}
                  onChange={(e) => setDefaultMarginPercent(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="validUntil">Valid Until *</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="bg-secondary border-border"
                />
                {errors.valid_until && (
                  <p className="text-sm text-destructive">{errors.valid_until}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card className="glass border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading">Line Items</CardTitle>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-1" />
                Import Document
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateProductDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                New Product
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={toggleAllExpanded}>
                {allExpanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                {allExpanded ? "Collapse All" : "Expand All"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={lineItems.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                {lineItems.map((item, index) => (
                  <SortableLineItem
                    key={item.id}
                    item={{
                      id: item.id,
                      product_id: item.product_id,
                      description: item.description,
                      quantity: item.quantity,
                      unit_price: item.unit_price,
                      margin: item.margin,
                      pricing_type: item.pricing_type,
                      is_taxable: item.is_taxable,
                      total: item.total,
                    }}
                    index={index}
                    products={products}
                    isCustomerTaxExempt={isCustomerTaxExempt}
                    canDelete={lineItems.length > 1}
                    productComboboxOpen={productComboboxStates[index] ?? false}
                    productSearch={productSearchStates[index] ?? ""}
                    errors={errors}
                    isExpanded={item.isExpanded ?? true}
                    onToggleExpand={() => toggleItemExpanded(index)}
                    getProductsByType={getProductsByType}
                    onUpdateItem={updateLineItem}
                    onRemoveItem={removeLineItem}
                    onSelectProduct={selectProduct}
                    onSetProductComboboxOpen={handleSetProductComboboxOpen}
                    onSetProductSearch={handleSetProductSearch}
                  />
                ))}
              </SortableContext>
            </DndContext>

            <Button type="button" variant="outline" className="w-full" onClick={addLineItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </CardContent>
        </Card>

        {/* Tax Exempt Warning */}
        {isCustomerTaxExempt && (
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm">This customer is tax exempt. Tax rate has been set to 0%.</span>
          </div>
        )}

        {/* Notes */}
        <Card className="glass border-border">
          <CardHeader>
            <CardTitle className="font-heading">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes or terms..."
              className="bg-secondary border-border min-h-[100px]"
            />
          </CardContent>
        </Card>

        {/* Summary */}
        <Card className="glass border-border">
          <CardHeader>
            <CardTitle className="font-heading">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax ({effectiveTaxRate}%)</span>
              <span className="font-medium">${taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-3">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-lg text-primary">${total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
          <Button type="submit" disabled={updateEstimate.isPending}>
            {updateEstimate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>

        {/* Preview Dialog */}
        <EstimatePreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          estimateNumber={estimate?.number}
          customerName={customers?.find((c) => c.id === selectedCustomerId)?.name || ""}
          projectName={projects?.find((p) => p.id === selectedProjectId)?.name}
          validUntil={validUntil}
          notes={notes}
          lineItems={lineItems.map((item, index) => ({
            id: item.id || `preview-${index}`,
            product_id: item.product_id,
            description: item.description,
            quantity: parseFloat(item.quantity) || 0,
            unit_price: parseFloat(item.unit_price) || 0,
            margin: parseFloat(item.margin) || 0,
            total: item.total,
            is_taxable: item.is_taxable,
          }))}
          taxRate={effectiveTaxRate}
          status={status}
        />
        {/* Import Document Dialog */}
        <ImportDocumentDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onImport={handleImportedItems}
        />

        {/* Inline Product Dialog */}
        <InlineProductDialog
          open={createProductDialogOpen}
          onOpenChange={setCreateProductDialogOpen}
        />
      </form>

      {/* Draft Recovery Dialog */}
      <AlertDialog open={showRecoveryDialog} onOpenChange={setShowRecoveryDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Unsaved Edits?</AlertDialogTitle>
            <AlertDialogDescription>
              We found unsaved changes from a previous session. Would you like to restore them or start fresh from the saved version?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardDraft}>
              Discard
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreDraft}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Changes Confirmation Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={(open) => !open && cancelLeave()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelLeave}>
              Continue Editing
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLeave}>
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
};

export default EditEstimate;
