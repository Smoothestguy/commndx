import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Loader2, AlertTriangle, Check, ChevronsUpDown, Save, Clock } from "lucide-react";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { useProjectsByCustomer } from "@/integrations/supabase/hooks/useProjects";
import { useProducts } from "@/integrations/supabase/hooks/useProducts";
import { useAddEstimate, useUpdateEstimate, EstimateWithLineItems } from "@/integrations/supabase/hooks/useEstimates";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { useQuickBooksConfig, useQuickBooksNextNumber } from "@/integrations/supabase/hooks/useQuickBooks";
import { useAutoSaveDraft } from "@/hooks/useAutoSaveDraft";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(500),
  quantity: z.number().positive("Quantity must be positive"),
  unit_price: z.number().positive("Unit price must be positive"),
  margin: z.number().min(0, "Margin cannot be negative").max(99.99, "Margin must be less than 100%"),
});

const estimateSchema = z.object({
  customer_id: z.string().uuid("Please select a customer"),
  tax_rate: z.number().min(0).max(100),
  valid_until: z.string().min(1, "Valid until date is required"),
  notes: z.string().max(1000).optional(),
});

interface LineItem {
  product_id?: string;
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
  draftId?: string;
}

export const EstimateForm = ({ initialData, draftId }: EstimateFormProps) => {
  const navigate = useNavigate();
  const { data: customers, isLoading: customersLoading } = useCustomers();
  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: companySettings } = useCompanySettings();
  const addEstimate = useAddEstimate();
  const updateEstimate = useUpdateEstimate();

  // QuickBooks integration
  const { data: qbConfig } = useQuickBooksConfig();
  const isQBConnected = qbConfig?.is_connected ?? false;
  const { data: qbNextNumber, isLoading: qbNumberLoading } = useQuickBooksNextNumber('estimate', isQBConnected);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialData?.customer_id || "");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialData?.project_id || "");
  const [taxRate, setTaxRate] = useState<string>(initialData?.tax_rate?.toString() || "8.25");
  const [validUntil, setValidUntil] = useState<string>(initialData?.valid_until || "");
  const [notes, setNotes] = useState<string>(initialData?.notes || "");
  const [status, setStatus] = useState<"draft" | "pending" | "sent" | "approved">(initialData?.status || "draft");
  const [defaultPricingType, setDefaultPricingType] = useState<'markup' | 'margin'>(initialData?.default_pricing_type || 'margin');
  const [estimateNumber, setEstimateNumber] = useState<string>(initialData?.number || "");
  const [isInitialized, setIsInitialized] = useState(!!initialData);

  // Combobox open states
  const [customerComboboxOpen, setCustomerComboboxOpen] = useState(false);
  const [projectComboboxOpen, setProjectComboboxOpen] = useState(false);
  const [productComboboxOpen, setProductComboboxOpen] = useState<Record<number, boolean>>({});

  // Search states for comboboxes
  const [customerSearch, setCustomerSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [productSearch, setProductSearch] = useState<Record<number, string>>({});

  const { data: projects } = useProjectsByCustomer(selectedCustomerId);

  const [lineItems, setLineItems] = useState<LineItem[]>(() => {
    if (initialData?.line_items && initialData.line_items.length > 0) {
      return initialData.line_items.map((item) => ({
        product_id: item.product_id,
        description: item.description,
        quantity: item.quantity.toString(),
        unit_price: item.unit_price.toString(),
        margin: item.markup.toString(),
        pricing_type: (item.pricing_type || 'margin') as 'markup' | 'margin',
        is_taxable: item.is_taxable ?? true,
        total: item.total,
      }));
    }
    return [{ description: "", quantity: "1", unit_price: "", margin: "0", pricing_type: "margin", is_taxable: true, total: 0 }];
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Helper to group products by type
  const getProductsByType = (type: 'product' | 'service' | 'labor') => {
    return products?.filter((p) => p.item_type === type) || [];
  };

  // Generate estimate number
  const generateEstimateNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `EST-${year}-${random}`;
  };

  // Set QuickBooks number when available (only for new estimates)
  useEffect(() => {
    if (!initialData) {
      if (qbNextNumber) {
        setEstimateNumber(qbNextNumber);
      } else if (!estimateNumber) {
        setEstimateNumber(generateEstimateNumber());
      }
    }
  }, [qbNextNumber, initialData]);

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

  const updateLineItem = (index: number, field: keyof LineItem, value: string | boolean) => {
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

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { description: "", quantity: "1", unit_price: "", margin: "0", pricing_type: defaultPricingType, is_taxable: true, total: 0 },
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
        description: product.description ? `${product.name} - ${product.description}` : product.name,
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

  // Auto-save draft logic
  const autoSaveData = useMemo(() => ({
    customer_id: selectedCustomerId || undefined,
    customer_name: selectedCustomer?.name || "Draft",
    project_id: selectedProjectId || undefined,
    project_name: projects?.find((p) => p.id === selectedProjectId)?.name,
    number: estimateNumber,
    status: "draft" as const,
    subtotal,
    tax_rate: effectiveTaxRate,
    tax_amount: taxAmount,
    total,
    notes: notes || undefined,
    valid_until: validUntil,
    default_pricing_type: defaultPricingType,
  }), [selectedCustomerId, selectedCustomer?.name, selectedProjectId, projects, estimateNumber, subtotal, effectiveTaxRate, taxAmount, total, notes, validUntil, defaultPricingType]);

  const autoSaveLineItems = useMemo(() => 
    lineItems.map((item) => ({
      product_id: item.product_id,
      description: item.description,
      quantity: parseFloat(item.quantity) || 0,
      unit_price: parseFloat(item.unit_price) || 0,
      markup: parseFloat(item.margin) || 0,
      pricing_type: item.pricing_type,
      is_taxable: item.is_taxable,
      total: item.total,
    })),
  [lineItems]);

  const { isSaving, lastSaved, hasUnsavedChanges, draftId: currentDraftId } = useAutoSaveDraft({
    estimateData: autoSaveData,
    lineItems: autoSaveLineItems,
    enabled: status === "draft" && isInitialized,
    debounceMs: 3000,
  });

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

    if (!validateForm()) {
      return;
    }

    const customer = customers?.find((c) => c.id === selectedCustomerId);
    const project = projects?.find((p) => p.id === selectedProjectId);

    if (!customer) return;

    const lineItemsData = lineItems.map((item) => ({
      product_id: item.product_id,
      description: item.description,
      quantity: parseFloat(item.quantity),
      unit_price: parseFloat(item.unit_price),
      markup: parseFloat(item.margin),
      pricing_type: item.pricing_type,
      is_taxable: item.is_taxable,
      total: item.total,
    }));

    // If we have a draft, update it instead of creating new
    const effectiveDraftId = currentDraftId || draftId;
    
    if (effectiveDraftId) {
      await updateEstimate.mutateAsync({
        id: effectiveDraftId,
        estimate: {
          number: estimateNumber,
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
        lineItems: lineItemsData,
      });
    } else {
      await addEstimate.mutateAsync({
        estimate: {
          number: estimateNumber,
          customer_id: selectedCustomerId,
          customer_name: customer.name,
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
        },
        lineItems: lineItemsData,
      });
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Auto-save indicator */}
      {status === "draft" && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
              Draft
            </Badge>
            {isSaving ? (
              <span className="text-sm flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </span>
            ) : lastSaved ? (
              <span className="text-sm flex items-center gap-1">
                <Save className="h-3 w-3" />
                Saved {formatDistanceToNow(lastSaved, { addSuffix: true })}
              </span>
            ) : hasUnsavedChanges ? (
              <span className="text-sm flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Unsaved changes
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Draft is saved automatically
          </p>
        </div>
      )}

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
                      ? customers?.find((c) => c.id === selectedCustomerId)?.name
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
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedCustomerId === customer.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{customer.name}</span>
                              {customer.company && (
                                <span className="text-xs text-muted-foreground">{customer.company}</span>
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
                    {qbNumberLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    QuickBooks
                  </Badge>
                )}
              </div>
              <Input
                id="estimateNumber"
                value={estimateNumber}
                onChange={(e) => setEstimateNumber(e.target.value)}
                className="bg-secondary border-border"
              />
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
              <Label htmlFor="defaultPricingType">Default Pricing Method</Label>
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
        <CardHeader>
          <CardTitle className="font-heading">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {lineItems.map((item, index) => (
            <div
              key={index}
              className="p-4 rounded-lg bg-secondary/50 border border-border space-y-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">Item {index + 1}</span>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`taxable-${index}`}
                      checked={item.is_taxable}
                      onCheckedChange={(checked) => updateLineItem(index, "is_taxable", checked.toString())}
                      disabled={isCustomerTaxExempt}
                    />
                    <Label htmlFor={`taxable-${index}`} className="text-xs text-muted-foreground">
                      Taxable
                    </Label>
                  </div>
                </div>
                {lineItems.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLineItem(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>

              {/* Product Combobox with Grouped Types */}
              <div className="space-y-2">
                <Label>Select Product (Optional)</Label>
                <Popover 
                  open={productComboboxOpen[index] || false} 
                  onOpenChange={(open) => setProductComboboxOpen(prev => ({ ...prev, [index]: open }))}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={productComboboxOpen[index] || false}
                      className="w-full justify-between bg-secondary border-border"
                    >
                      {item.product_id
                        ? (() => {
                            const product = products?.find((p) => p.id === item.product_id);
                            return product 
                              ? `${product.name}${product.description ? ` - ${product.description}` : ''}`
                              : 'Unknown product';
                          })()
                        : "Search product, service, or labor..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[500px] p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Search by name, SKU, or category..." 
                        value={productSearch[index] || ""}
                        onValueChange={(v) => setProductSearch(prev => ({ ...prev, [index]: v }))}
                      />
                      <CommandList>
                        <CommandEmpty>No product found.</CommandEmpty>
                        {getProductsByType('product').length > 0 && (
                          <CommandGroup heading="Products">
                            {getProductsByType('product').map((product) => (
                              <CommandItem
                                key={product.id}
                                value={`${product.name} ${product.sku || ''} ${product.category}`}
                                onSelect={() => {
                                  selectProduct(index, product.id);
                                  setProductComboboxOpen(prev => ({ ...prev, [index]: false }));
                                  setProductSearch(prev => ({ ...prev, [index]: "" }));
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
                                  selectProduct(index, product.id);
                                  setProductComboboxOpen(prev => ({ ...prev, [index]: false }));
                                  setProductSearch(prev => ({ ...prev, [index]: "" }));
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
                                  selectProduct(index, product.id);
                                  setProductComboboxOpen(prev => ({ ...prev, [index]: false }));
                                  setProductSearch(prev => ({ ...prev, [index]: "" }));
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
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Description Textarea */}
                <div className="space-y-2 sm:col-span-2">
                  <div className="flex items-center gap-2">
                    <Label>Description *</Label>
                    {item.product_id && (
                      <Badge variant="secondary" className="text-xs">
                        {products?.find(p => p.id === item.product_id)?.unit}
                      </Badge>
                    )}
                  </div>
                  <Textarea
                    value={item.description}
                    onChange={(e) => {
                      updateLineItem(index, "description", e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    placeholder="Item description"
                    className="bg-secondary border-border min-h-[80px] resize-none overflow-hidden"
                    ref={(el) => {
                      if (el) {
                        el.style.height = 'auto';
                        el.style.height = el.scrollHeight + 'px';
                      }
                    }}
                  />
                  {errors[`line_${index}_description`] && (
                    <p className="text-sm text-destructive">
                      {errors[`line_${index}_description`]}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                    className="bg-secondary border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Unit Price *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updateLineItem(index, "unit_price", e.target.value)}
                      className="bg-secondary border-border pl-7"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Pricing Method</Label>
                  <Select
                    value={item.pricing_type}
                    onValueChange={(v: 'markup' | 'margin') => updateLineItem(index, "pricing_type", v)}
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="margin">Margin</SelectItem>
                      <SelectItem value="markup">Markup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{item.pricing_type === 'margin' ? 'Margin (%)' : 'Markup (%)'}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    max={item.pricing_type === 'margin' ? "99.99" : undefined}
                    value={item.margin}
                    onChange={(e) => updateLineItem(index, "margin", e.target.value)}
                    className="bg-secondary border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Total</Label>
                  <Input
                    value={`$${item.total.toFixed(2)}`}
                    readOnly
                    className="bg-muted border-border font-semibold"
                  />
                </div>
              </div>
            </div>
          ))}
          
          <Button type="button" variant="outline" className="w-full" onClick={addLineItem}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card className="glass border-border">
        <CardHeader>
          <CardTitle className="font-heading">Additional Information</CardTitle>
        </CardHeader>
        <CardContent>
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

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/estimates")}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" variant="glow" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {(currentDraftId || draftId) ? "Save Estimate" : "Create Estimate"}
        </Button>
      </div>
    </form>
  );
};
