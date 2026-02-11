import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalculatorInput } from "@/components/ui/calculator-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/command";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Loader2, AlertTriangle, Check, ChevronsUpDown, Eye, ChevronsDownUp, ChevronsUpDownIcon } from "lucide-react";
import { EstimatePreviewDialog } from "./EstimatePreviewDialog";
import { SortableLineItem } from "./SortableLineItem";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { useProjectsByCustomer } from "@/integrations/supabase/hooks/useProjects";
import { useProducts } from "@/integrations/supabase/hooks/useProducts";
import { useAddEstimate, useUpdateEstimate, EstimateWithLineItems } from "@/integrations/supabase/hooks/useEstimates";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { useQuickBooksConfig } from "@/integrations/supabase/hooks/useQuickBooks";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PendingAttachmentsUpload, PendingFile } from "@/components/shared/PendingAttachmentsUpload";
import { finalizeAttachments, cleanupPendingAttachments } from "@/utils/attachmentUtils";
import { toast } from "sonner";
import { getNextEstimateNumber } from "@/utils/estimateNumberGenerator";
import { InlineProductDialog } from "@/components/products/InlineProductDialog";
import { ImportDocumentDialog } from "./ImportDocumentDialog";
import { ExtractedItem } from "@/components/job-orders/ExtractedItemsTable";
import { Upload } from "lucide-react";

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
}

interface EstimateFormProps {
  initialData?: EstimateWithLineItems;
}

export const EstimateForm = ({ initialData }: EstimateFormProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: customers, isLoading: customersLoading } = useCustomers();
  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: companySettings } = useCompanySettings();
  const addEstimate = useAddEstimate();
  const updateEstimate = useUpdateEstimate();

  // Fetch current user's profile for sales rep name
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();
      if (profile) {
        setCurrentUserName(`${profile.first_name || ''} ${profile.last_name || ''}`.trim() || null);
      }
    };
    fetchUserProfile();
  }, [user?.id]);

  // QuickBooks integration - used to show badge on estimate number
  const { data: qbConfig } = useQuickBooksConfig();
  const isQBConnected = qbConfig?.is_connected ?? false;

  // Pending attachments state (for new estimates)
  const [pendingAttachments, setPendingAttachments] = useState<PendingFile[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialData?.customer_id || "");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialData?.project_id || "");
  const [taxRate, setTaxRate] = useState<string>(initialData?.tax_rate?.toString() || "8.25");
  const [validUntil, setValidUntil] = useState<string>(initialData?.valid_until || "");
  const [notes, setNotes] = useState<string>(initialData?.notes || "");
  const [jobsiteAddress, setJobsiteAddress] = useState<string>(initialData?.jobsite_address || "");
  const [status, setStatus] = useState<"draft" | "pending" | "sent" | "approved" | "closed">(initialData?.status || "draft");
  const [defaultPricingType, setDefaultPricingType] = useState<'markup' | 'margin'>(initialData?.default_pricing_type || 'margin');
  const [defaultMarginPercent, setDefaultMarginPercent] = useState<string>("30");
  const [estimateNumber, setEstimateNumber] = useState<string>(initialData?.number || "");
  const [isNumberLoading, setIsNumberLoading] = useState(!initialData);
  const [isInitialized, setIsInitialized] = useState(!!initialData);

  // Combobox open states
  const [customerComboboxOpen, setCustomerComboboxOpen] = useState(false);
  const [projectComboboxOpen, setProjectComboboxOpen] = useState(false);
  const [productComboboxOpen, setProductComboboxOpen] = useState<Record<number, boolean>>({});

  // Search states for comboboxes
  const [customerSearch, setCustomerSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [productSearch, setProductSearch] = useState<Record<number, string>>({});
  
  // Preview dialog state
  const [previewOpen, setPreviewOpen] = useState(false);
  
  // Create product dialog state
  const [createProductDialogOpen, setCreateProductDialogOpen] = useState(false);
  
  // Import document dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Expanded state for collapsible line items
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => new Set());

  const { data: projects } = useProjectsByCustomer(selectedCustomerId);

  const [lineItems, setLineItems] = useState<LineItem[]>(() => {
    if (initialData?.line_items && initialData.line_items.length > 0) {
      return initialData.line_items.map((item) => ({
        id: crypto.randomUUID(),
        product_id: item.product_id,
        product_name: (item as any).product_name || undefined,
        description: item.description,
        quantity: item.quantity.toString(),
        unit_price: item.unit_price.toString(),
        margin: item.markup.toString(),
        pricing_type: (item.pricing_type || 'margin') as 'markup' | 'margin',
        is_taxable: item.is_taxable ?? true,
        total: item.total,
      }));
    }
    return [{ id: crypto.randomUUID(), description: "", quantity: "1", unit_price: "", margin: "30", pricing_type: "margin" as const, is_taxable: true, total: 0 }];
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

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

  // Set initial state after form is initialized
  useEffect(() => {
    if (isInitialized && !initialStateRef.current) {
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

  // Helper to group products by type
  const getProductsByType = (type: 'product' | 'service' | 'labor') => {
    return products?.filter((p) => p.item_type === type) || [];
  };

  // Fetch estimate number (only for new estimates)
  useEffect(() => {
    if (!initialData && !estimateNumber) {
      const fetchEstimateNumber = async () => {
        setIsNumberLoading(true);
        try {
          const { number } = await getNextEstimateNumber();
          setEstimateNumber(number);
        } catch (error) {
          console.error('Failed to generate estimate number:', error);
          // Fallback to basic format if all else fails
          const date = new Date();
          const fallback = `EST-${date.getFullYear()}-${Date.now().toString().slice(-6)}`;
          setEstimateNumber(fallback);
          toast.error('Failed to generate estimate number, using fallback');
        } finally {
          setIsNumberLoading(false);
        }
      };
      fetchEstimateNumber();
    }
  }, [initialData]);

  const calculateLineItemTotal = (quantity: string, unitPrice: string, percentage: string, pricingType: 'markup' | 'margin') => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    const pct = parseFloat(percentage) || 0;
    
    if (pricingType === 'markup') {
      // Markup: add percentage on top of cost
      return qty * price * (1 + pct / 100);
    } else {
      // Margin: percentage of selling price
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

  const updateLineItem = (index: number, field: keyof Omit<LineItem, 'id'>, value: string | boolean) => {
    const newLineItems = [...lineItems];
    
    // Handle boolean fields properly
    if (field === "is_taxable") {
      newLineItems[index] = { ...newLineItems[index], [field]: value === "true" || value === true };
    } else {
      newLineItems[index] = { ...newLineItems[index], [field]: value };
    }

    // Recalculate total for this line item
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

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
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

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: crypto.randomUUID(), description: "", quantity: "1", unit_price: "", margin: defaultMarginPercent, pricing_type: defaultPricingType, is_taxable: true, total: 0 },
    ]);
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
      const margin = product.markup.toString(); // DB column is still "markup"
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

  // Get selected customer for tax exempt check
  const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);
  const isCustomerTaxExempt = selectedCustomer?.tax_exempt ?? false;

  // Calculate totals with smart tax (only on taxable items)
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxableSubtotal = lineItems.filter(item => item.is_taxable).reduce((sum, item) => sum + item.total, 0);
  const nonTaxableSubtotal = subtotal - taxableSubtotal;
  const effectiveTaxRate = isCustomerTaxExempt ? 0 : (parseFloat(taxRate) || 0);
  const taxAmount = taxableSubtotal * effectiveTaxRate / 100;
  const total = subtotal + taxAmount;

  // Load default tax rate from company settings (only for new estimates)
  useEffect(() => {
    if (!initialData && companySettings?.default_tax_rate) {
      setTaxRate(companySettings.default_tax_rate.toString());
    }
  }, [companySettings, initialData]);

  // Mark as initialized after first render
  useEffect(() => {
    if (!isInitialized) {
      const timer = setTimeout(() => setIsInitialized(true), 500);
      return () => clearTimeout(timer);
    }
  }, [isInitialized]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const itemsWithErrors = new Set<string>();

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
            itemsWithErrors.add(item.id);
          });
        }
      }
    });

    // Auto-expand line items with errors
    if (itemsWithErrors.size > 0) {
      setExpandedItems(prev => new Set([...prev, ...itemsWithErrors]));
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the validation errors before saving");
      return;
    }

    const customer = customers?.find((c) => c.id === selectedCustomerId);
    const project = projects?.find((p) => p.id === selectedProjectId);

    if (!customer) return;

    const lineItemsData = lineItems.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      description: item.description,
      quantity: parseFloat(item.quantity),
      unit_price: parseFloat(item.unit_price),
      markup: parseFloat(item.margin),
      pricing_type: item.pricing_type,
      is_taxable: item.is_taxable,
      total: item.total,
    }));

    let savedEstimateId: string | undefined;
    
    if (initialData?.id) {
      await updateEstimate.mutateAsync({
        id: initialData.id,
        estimate: {
          number: estimateNumber,
          customer_id: selectedCustomerId,
          customer_name: customer.company || customer.name,
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
          jobsite_address: jobsiteAddress || null,
        },
        lineItems: lineItemsData,
      });
      savedEstimateId = initialData.id;
    } else {
      const result = await addEstimate.mutateAsync({
        estimate: {
          number: estimateNumber,
          customer_id: selectedCustomerId,
          customer_name: customer.company || customer.name,
          project_id: selectedProjectId || undefined,
          project_name: project?.name || undefined,
          status,
          subtotal,
          tax_rate: effectiveTaxRate,
          tax_amount: taxAmount,
          total,
          notes: notes || undefined,
          valid_until: validUntil,
          default_pricing_type: defaultPricingType,
          jobsite_address: jobsiteAddress || undefined,
        },
        lineItems: lineItemsData,
      });
      savedEstimateId = result.id;
    }
    
    // Finalize pending attachments
    if (savedEstimateId && pendingAttachments.length > 0 && user) {
      const attachResult = await finalizeAttachments(
        pendingAttachments,
        savedEstimateId,
        "estimate",
        user.id
      );
      if (!attachResult.success) {
        toast.error("Estimate saved but some attachments failed to upload");
      }
    }
    
    navigate("/estimates");
  };

  // Handle cancel with unsaved changes check
  const handleCancel = async () => {
    const shouldProceed = handleCancelClick();
    if (shouldProceed) {
      // Cleanup pending attachments when canceling
      if (pendingAttachments.length > 0) {
        await cleanupPendingAttachments(pendingAttachments);
      }
      navigate("/estimates");
    }
  };

  // Handle confirm leave from dialog
  const handleConfirmLeave = async () => {
    confirmLeave();
    // Cleanup pending attachments when leaving
    if (pendingAttachments.length > 0) {
      await cleanupPendingAttachments(pendingAttachments);
    }
    navigate("/estimates");
  };

  // Set default valid until date (30 days from now) - only for new estimates
  useEffect(() => {
    if (!initialData && !validUntil) {
      const date = new Date();
      date.setDate(date.getDate() + 30);
      setValidUntil(date.toISOString().split("T")[0]);
    }
  }, [initialData, validUntil]);

  // Reset project when customer changes (only if not loading initial data)
  useEffect(() => {
    if (isInitialized && !initialData) {
      setSelectedProjectId("");
    }
  }, [selectedCustomerId, isInitialized, initialData]);

  const isPending = addEstimate.isPending || updateEstimate.isPending;

  if (customersLoading || productsLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer & Project Selection */}
        <Card className="glass border-border">
          <CardHeader>
            <CardTitle className="font-heading">Customer & Project</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Customer Combobox */}
              <div className="space-y-2">
                <Label htmlFor="customer">Customer *</Label>
                <Popover open={customerComboboxOpen} onOpenChange={setCustomerComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerComboboxOpen}
                      className="w-full justify-between bg-secondary border-border"
                    >
                      {selectedCustomerId
                        ? (() => {
                            const c = customers?.find((c) => c.id === selectedCustomerId);
                            return c?.company || c?.name || "Search customer...";
                          })()
                        : "Search customer..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Search by name or company..." 
                        value={customerSearch}
                        onValueChange={setCustomerSearch}
                      />
                      <CommandList>
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                          {customers?.map((customer) => (
                            <CommandItem
                              key={customer.id}
                              value={`${customer.name} ${customer.company || ''}`}
                              onSelect={() => {
                                setSelectedCustomerId(customer.id);
                                setCustomerComboboxOpen(false);
                                setCustomerSearch("");
                                // Pre-populate jobsite address from customer's default if empty
                                if (!jobsiteAddress && customer.jobsite_address) {
                                  setJobsiteAddress(customer.jobsite_address);
                                }
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedCustomerId === customer.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{customer.company || customer.name}</span>
                                {customer.company && customer.name && customer.company !== customer.name && (
                                  <span className="text-xs text-muted-foreground">{customer.name}</span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {errors.customer_id && (
                  <p className="text-sm text-destructive">{errors.customer_id}</p>
                )}
              </div>

              {/* Project Combobox */}
              <div className="space-y-2">
                <Label htmlFor="project">Project (Optional)</Label>
                <Popover open={projectComboboxOpen} onOpenChange={setProjectComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={projectComboboxOpen}
                      className="w-full justify-between bg-secondary border-border"
                      disabled={!selectedCustomerId}
                    >
                      {selectedProjectId
                        ? projects?.find((p) => p.id === selectedProjectId)?.name
                        : "Search project..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Search by project name..." 
                        value={projectSearch}
                        onValueChange={setProjectSearch}
                      />
                      <CommandList>
                        <CommandEmpty>No project found.</CommandEmpty>
                        <CommandGroup>
                          {projects?.map((project) => (
                            <CommandItem
                              key={project.id}
                              value={project.name}
                              onSelect={() => {
                                setSelectedProjectId(project.id);
                                setProjectComboboxOpen(false);
                                setProjectSearch("");
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedProjectId === project.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {project.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="estimateNumber">Estimate Number</Label>
                  {isQBConnected && (
                    <Badge variant="outline" className="text-xs">
                      QuickBooks
                    </Badge>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="estimateNumber"
                    value={estimateNumber}
                    onChange={(e) => setEstimateNumber(e.target.value)}
                    className="bg-secondary border-border"
                    disabled={isNumberLoading}
                  />
                  {isNumberLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>

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
                <CalculatorInput
                  value={parseFloat(defaultMarginPercent) || 0}
                  onValueChange={(value) => setDefaultMarginPercent(value.toString())}
                  className="bg-secondary border-border"
                  decimalPlaces={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                <CalculatorInput
                  value={parseFloat(taxRate) || 0}
                  onValueChange={(value) => setTaxRate(value.toString())}
                  className="bg-secondary border-border"
                  decimalPlaces={2}
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setImportDialogOpen(true)}
                className="text-xs"
              >
                <Upload className="h-4 w-4 mr-1" />
                Import Document
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateProductDialogOpen(true)}
                className="text-xs"
              >
                <Plus className="h-4 w-4 mr-1" />
                New Product
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (expandedItems.size === lineItems.length) {
                    setExpandedItems(new Set());
                  } else {
                    setExpandedItems(new Set(lineItems.map(item => item.id)));
                  }
                }}
                className="text-xs"
              >
                {expandedItems.size === lineItems.length ? (
                  <>
                    <ChevronsDownUp className="h-4 w-4 mr-1" />
                    Collapse All
                  </>
                ) : (
                  <>
                    <ChevronsUpDownIcon className="h-4 w-4 mr-1" />
                    Expand All
                  </>
                )}
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
                    item={item}
                    index={index}
                    products={products}
                    isCustomerTaxExempt={isCustomerTaxExempt}
                    canDelete={lineItems.length > 1}
                    productComboboxOpen={productComboboxOpen[index] || false}
                    productSearch={productSearch[index] || ""}
                    errors={errors}
                    isExpanded={expandedItems.has(item.id)}
                    onToggleExpand={() => {
                      setExpandedItems(prev => {
                        const next = new Set(prev);
                        if (next.has(item.id)) {
                          next.delete(item.id);
                        } else {
                          next.add(item.id);
                        }
                        return next;
                      });
                    }}
                    getProductsByType={getProductsByType}
                    onUpdateItem={updateLineItem}
                    onRemoveItem={removeLineItem}
                    onSelectProduct={selectProduct}
                    onSetProductComboboxOpen={(idx, open) => setProductComboboxOpen(prev => ({ ...prev, [idx]: open }))}
                    onSetProductSearch={(idx, value) => setProductSearch(prev => ({ ...prev, [idx]: value }))}
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

        {/* Notes & Jobsite Address */}
        <Card className="glass border-border">
          <CardHeader>
            <CardTitle className="font-heading">Additional Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="jobsiteAddress">Jobsite / Delivery Address (Optional)</Label>
              <Textarea
                id="jobsiteAddress"
                value={jobsiteAddress}
                onChange={(e) => setJobsiteAddress(e.target.value)}
                placeholder="Enter jobsite or delivery address if different from billing address..."
                className="bg-secondary border-border min-h-[80px]"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">This address will appear on the estimate PDF as "Ship to / Jobsite"</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes or terms..."
                className="bg-secondary border-border min-h-[100px]"
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground">{notes.length}/1000 characters</p>
            </div>
          </CardContent>
        </Card>

        {/* Totals */}
        <Card className="glass border-border">
          <CardContent className="pt-6">
            {isCustomerTaxExempt && (
              <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Tax Exempt Customer - No tax will be applied</span>
              </div>
            )}
            <div className="space-y-2">
              {nonTaxableSubtotal > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Taxable Subtotal:</span>
                    <span className="font-medium">${taxableSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Non-Taxable Subtotal:</span>
                    <span className="font-medium">${nonTaxableSubtotal.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Tax ({effectiveTaxRate}%{isCustomerTaxExempt ? ' - Exempt' : ''}):
                </span>
                <span className="font-medium">${taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-heading border-t border-border pt-2">
                <span className="font-bold">Total:</span>
                <span className="font-bold text-primary">${total.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attachments Section - Only for new estimates */}
        {!initialData && (
          <PendingAttachmentsUpload
            entityType="estimate"
            pendingFiles={pendingAttachments}
            onFilesChange={setPendingAttachments}
          />
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPreviewOpen(true)}
            disabled={isPending}
          >
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
          <Button type="submit" variant="glow" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialData ? "Save Estimate" : "Create Estimate"}
          </Button>
        </div>

        {/* Preview Dialog */}
        <EstimatePreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          estimateNumber={estimateNumber || undefined}
          customerName={customers?.find((c) => c.id === selectedCustomerId)?.name || ""}
          projectName={projects?.find((p) => p.id === selectedProjectId)?.name}
          validUntil={validUntil}
          notes={notes}
          lineItems={lineItems.map((item, index) => ({
            id: `preview-${index}`,
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
          salesRepName={currentUserName}
        />
      </form>

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

      {/* Create Product Dialog */}
      <InlineProductDialog
        open={createProductDialogOpen}
        onOpenChange={setCreateProductDialogOpen}
        onSuccess={() => {
          // Products query will automatically refetch
        }}
      />

      {/* Import Document Dialog */}
      <ImportDocumentDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImport={(items: ExtractedItem[]) => {
          // Convert ExtractedItem[] to LineItem[] and append
          const newItems: LineItem[] = items.map((item) => ({
            id: crypto.randomUUID(),
            product_id: item.matchedProductId || undefined,
            description: item.description,
            quantity: item.quantity.toString(),
            unit_price: item.unitPrice.toString(),
            margin: "0",
            pricing_type: "margin" as const,
            is_taxable: true,
            total: item.total,
          }));
          setLineItems((prev) => [...prev, ...newItems]);
        }}
      />
    </>
  );
};
