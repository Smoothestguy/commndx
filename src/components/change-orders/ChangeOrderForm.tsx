import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Plus, Trash2, Save, X, ArrowRightLeft, Check, ChevronsUpDown, Lock, RotateCcw, AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { useProducts } from "@/integrations/supabase/hooks/useProducts";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import { useJobOrders } from "@/integrations/supabase/hooks/useJobOrders";
import { usePurchaseOrders } from "@/integrations/supabase/hooks/usePurchaseOrders";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import {
  useAddChangeOrder,
  useUpdateChangeOrder,
  ChangeOrderLineItem,
  ChangeOrderWithLineItems,
  ChangeType,
} from "@/integrations/supabase/hooks/useChangeOrders";
import { ChangeOrderPermissions } from "@/hooks/useChangeOrderPermissions";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { cn } from "@/lib/utils";

interface LineItem {
  id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  vendor_cost: number;
  markup: number;
  total: number;
  is_taxable: boolean;
  sort_order: number;
  calculation_mode: 'forward' | 'reverse';
  original_scope_description?: string | null;
}

interface ChangeOrderFormProps {
  initialData?: ChangeOrderWithLineItems;
  defaultProjectId?: string;
  defaultPurchaseOrderId?: string;
  permissions?: ChangeOrderPermissions;
}

export function ChangeOrderForm({
  initialData,
  defaultProjectId,
  defaultPurchaseOrderId,
  permissions,
}: ChangeOrderFormProps) {
  const navigate = useNavigate();
  const { data: projects } = useProjects();
  const { data: customers } = useCustomers();
  const { data: products } = useProducts();
  const { data: vendors } = useVendors();
  const { data: jobOrders } = useJobOrders();
  const { data: purchaseOrders } = usePurchaseOrders();
  const { data: companySettings } = useCompanySettings();

  const addChangeOrder = useAddChangeOrder();
  const updateChangeOrder = useUpdateChangeOrder();

  // Permission-based controls
  const isReadOnly = permissions && !permissions.canEdit;
  const canViewCosts = permissions?.canViewCosts ?? true;
  const canViewMargins = permissions?.canViewMargins ?? true;
  const canEditLineItems = permissions?.canEditLineItems ?? true;
  const canEditPricing = permissions?.canEditPricing ?? true;

  const [projectId, setProjectId] = useState(initialData?.project_id || defaultProjectId || "");
  const [customerId, setCustomerId] = useState(initialData?.customer_id || "");
  const [customerName, setCustomerName] = useState(initialData?.customer_name || "");
  const [vendorId, setVendorId] = useState(initialData?.vendor_id || "");
  const [vendorName, setVendorName] = useState(initialData?.vendor_name || "");
  const [purchaseOrderId, setPurchaseOrderId] = useState(
    initialData?.purchase_order_id || defaultPurchaseOrderId || ""
  );
  const [jobOrderId, setJobOrderId] = useState(initialData?.job_order_id || "");
  const [reason, setReason] = useState(initialData?.reason || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [taxRate, setTaxRate] = useState(initialData?.tax_rate || companySettings?.default_tax_rate || 0);
  const [changeType, setChangeType] = useState<ChangeType>(initialData?.change_type || "additive");
  const [scopeReference, setScopeReference] = useState(initialData?.scope_reference || "");
  const [sourceEstimateId, setSourceEstimateId] = useState(initialData?.source_estimate_id || "");
  const [sourceJobOrderId, setSourceJobOrderId] = useState(initialData?.source_job_order_id || "");
  const [lineItems, setLineItems] = useState<LineItem[]>(
    initialData?.line_items?.map((item) => ({
      ...item,
      id: item.id,
      vendor_cost: item.vendor_cost || 0,
      calculation_mode: 'forward' as const,
      original_scope_description: item.original_scope_description || "",
    })) || []
  );

  // Combobox states
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [vendorOpen, setVendorOpen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");
  const [poOpen, setPOOpen] = useState(false);
  const [poSearch, setPOSearch] = useState("");
  const [joOpen, setJOOpen] = useState(false);
  const [joSearch, setJOSearch] = useState("");
  const [productOpenIndex, setProductOpenIndex] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState("");

  // Unsaved changes tracking
  const [showRevertDialog, setShowRevertDialog] = useState(false);
  const initialStateRef = useRef<{
    projectId: string;
    customerId: string;
    customerName: string;
    vendorId: string;
    vendorName: string;
    purchaseOrderId: string;
    jobOrderId: string;
    reason: string;
    description: string;
    taxRate: number;
    changeType: ChangeType;
    scopeReference: string;
    sourceEstimateId: string;
    sourceJobOrderId: string;
    lineItems: string;
  } | null>(null);

  // Initialize initial state for change tracking (only in edit mode)
  useEffect(() => {
    if (initialData && !initialStateRef.current) {
      initialStateRef.current = {
        projectId: initialData.project_id || "",
        customerId: initialData.customer_id || "",
        customerName: initialData.customer_name || "",
        vendorId: initialData.vendor_id || "",
        vendorName: initialData.vendor_name || "",
        purchaseOrderId: initialData.purchase_order_id || "",
        jobOrderId: initialData.job_order_id || "",
        reason: initialData.reason || "",
        description: initialData.description || "",
        taxRate: initialData.tax_rate || 0,
        changeType: initialData.change_type || "additive",
        scopeReference: initialData.scope_reference || "",
        sourceEstimateId: initialData.source_estimate_id || "",
        sourceJobOrderId: initialData.source_job_order_id || "",
        lineItems: JSON.stringify(initialData.line_items?.map(item => ({
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          vendor_cost: item.vendor_cost || 0,
          markup: item.markup,
          total: item.total,
          is_taxable: item.is_taxable,
          original_scope_description: item.original_scope_description || "",
        })) || []),
      };
    }
  }, [initialData]);

  // Calculate if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!initialStateRef.current || !initialData) return false;

    const currentLineItems = JSON.stringify(lineItems.map(item => ({
      product_id: item.product_id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      vendor_cost: item.vendor_cost || 0,
      markup: item.markup,
      total: item.total,
      is_taxable: item.is_taxable,
    })));

    return (
      projectId !== initialStateRef.current.projectId ||
      customerId !== initialStateRef.current.customerId ||
      customerName !== initialStateRef.current.customerName ||
      vendorId !== initialStateRef.current.vendorId ||
      vendorName !== initialStateRef.current.vendorName ||
      purchaseOrderId !== initialStateRef.current.purchaseOrderId ||
      jobOrderId !== initialStateRef.current.jobOrderId ||
      reason !== initialStateRef.current.reason ||
      description !== initialStateRef.current.description ||
      taxRate !== initialStateRef.current.taxRate ||
      changeType !== initialStateRef.current.changeType ||
      currentLineItems !== initialStateRef.current.lineItems
    );
  }, [projectId, customerId, customerName, vendorId, vendorName, purchaseOrderId, jobOrderId, reason, description, taxRate, changeType, lineItems, initialData]);

  // Navigation guard hook
  const {
    showLeaveDialog,
    setShowLeaveDialog,
    confirmLeave,
    cancelLeave,
    handleCancelClick,
  } = useUnsavedChangesWarning({
    hasUnsavedChanges,
    enabled: !!initialData,
  });

  // Handle cancel button click
  const handleCancel = () => {
    const shouldProceed = handleCancelClick();
    if (shouldProceed) {
      navigate(-1);
    }
  };

  // Handle confirmed leave
  const handleConfirmLeave = () => {
    confirmLeave();
    navigate(-1);
  };

  // Handle revert changes
  const handleRevertChanges = () => {
    if (!initialStateRef.current || !initialData) return;

    setProjectId(initialStateRef.current.projectId);
    setCustomerId(initialStateRef.current.customerId);
    setCustomerName(initialStateRef.current.customerName);
    setVendorId(initialStateRef.current.vendorId);
    setVendorName(initialStateRef.current.vendorName);
    setPurchaseOrderId(initialStateRef.current.purchaseOrderId);
    setJobOrderId(initialStateRef.current.jobOrderId);
    setReason(initialStateRef.current.reason);
    setDescription(initialStateRef.current.description);
    setTaxRate(initialStateRef.current.taxRate);
    setChangeType(initialStateRef.current.changeType);
    setLineItems(initialData.line_items?.map((item) => ({
      ...item,
      id: item.id,
      vendor_cost: item.vendor_cost || 0,
      calculation_mode: 'forward' as const,
    })) || []);

    setShowRevertDialog(false);
  };

  // Auto-populate customer when project changes
  useEffect(() => {
    if (projectId && projects && customers) {
      const project = projects.find((p) => p.id === projectId);
      if (project?.customer_id) {
        const customer = customers.find((c) => c.id === project.customer_id);
        if (customer) {
          setCustomerId(customer.id);
          setCustomerName(customer.name);
        }
      }
    }
  }, [projectId, projects, customers]);

  // Auto-populate vendor name
  useEffect(() => {
    if (vendorId && vendors) {
      const vendor = vendors.find((v) => v.id === vendorId);
      if (vendor) {
        setVendorName(vendor.name);
      }
    }
  }, [vendorId, vendors]);

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: `temp-${Date.now()}`,
        product_id: null,
        description: "",
        quantity: 1,
        unit_price: 0,
        vendor_cost: 0,
        markup: 0,
        total: 0,
        is_taxable: true,
        sort_order: lineItems.length,
        calculation_mode: 'forward',
      },
    ]);
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: unknown) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

    const qty = field === "quantity" ? (value as number) : updated[index].quantity;
    const price = field === "unit_price" ? (value as number) : updated[index].unit_price;
    const markup = field === "markup" ? (value as number) : updated[index].markup;
    const total = field === "total" ? (value as number) : updated[index].total;
    const mode = updated[index].calculation_mode;

    if (mode === 'reverse') {
      // Reverse mode: Keep total fixed, calculate unit_price
      if (field === "total") {
        const multiplier = qty * (1 + markup / 100);
        updated[index].unit_price = multiplier > 0 ? (value as number) / multiplier : 0;
        updated[index].total = value as number;
      } else if (field === "quantity" || field === "markup") {
        const newQty = field === "quantity" ? (value as number) : qty;
        const newMarkup = field === "markup" ? (value as number) : markup;
        const multiplier = newQty * (1 + newMarkup / 100);
        updated[index].unit_price = multiplier > 0 ? total / multiplier : 0;
      } else if (field === "unit_price") {
        updated[index].total = qty * (value as number) * (1 + markup / 100);
      }
    } else {
      // Forward mode: Calculate total from components
      if (field === "quantity" || field === "unit_price" || field === "markup") {
        updated[index].total = qty * price * (1 + markup / 100);
      } else if (field === "total") {
        const multiplier = qty * (1 + markup / 100);
        updated[index].unit_price = multiplier > 0 ? (value as number) / multiplier : 0;
        updated[index].total = value as number;
      }
    }

    setLineItems(updated);
  };

  const toggleCalculationMode = (index: number) => {
    const updated = [...lineItems];
    updated[index].calculation_mode = updated[index].calculation_mode === 'forward' ? 'reverse' : 'forward';
    setLineItems(updated);
  };

  const formatCalculationBreakdown = (item: LineItem) => {
    const basePrice = item.quantity * item.unit_price;
    const markupAmount = basePrice * (item.markup / 100);
    return `$${item.unit_price.toFixed(2)} × ${item.quantity} = $${basePrice.toFixed(2)} + ${item.markup}% ($${markupAmount.toFixed(2)}) = $${item.total.toFixed(2)}`;
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const selectProduct = (index: number, productId: string) => {
    const product = products?.find((p) => p.id === productId);
    if (product) {
      const updated = [...lineItems];
      updated[index] = {
        ...updated[index],
        product_id: productId,
        description: product.name,
        unit_price: product.cost,
        markup: product.markup,
        total: updated[index].quantity * product.cost * (1 + product.markup / 100),
      };
      setLineItems(updated);
    }
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const vendorCostTotal = lineItems.reduce((sum, item) => sum + (item.quantity * (item.vendor_cost || 0)), 0);
  const taxableAmount = lineItems.filter((item) => item.is_taxable).reduce((sum, item) => sum + item.total, 0);
  const taxAmount = taxableAmount * (taxRate / 100);
  const total = subtotal + taxAmount;
  const grossProfit = total - vendorCostTotal;
  const marginPercent = vendorCostTotal > 0 ? ((grossProfit / vendorCostTotal) * 100) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation for deductive change orders
    if (changeType === 'deductive') {
      if (!scopeReference.trim()) {
        toast.error("Scope reference is required for deductive change orders");
        return;
      }
      if (lineItems.length === 0) {
        toast.error("At least one line item is required for deductive change orders");
        return;
      }
    }

    // Reason is always required
    if (!reason.trim()) {
      toast.error("Reason for change order is required");
      return;
    }

    const data = {
      project_id: projectId,
      customer_id: customerId,
      customer_name: customerName,
      vendor_id: vendorId || undefined,
      vendor_name: vendorName || undefined,
      purchase_order_id: purchaseOrderId || undefined,
      job_order_id: jobOrderId || undefined,
      reason,
      description: description || undefined,
      tax_rate: taxRate,
      change_type: changeType,
      scope_reference: changeType === 'deductive' ? scopeReference : null,
      source_estimate_id: changeType === 'deductive' && sourceEstimateId ? sourceEstimateId : undefined,
      source_job_order_id: changeType === 'deductive' && sourceJobOrderId ? sourceJobOrderId : undefined,
      line_items: lineItems.map(({ id, calculation_mode, ...item }, index) => ({
        ...item,
        vendor_cost: item.vendor_cost || 0,
        sort_order: index,
        original_scope_description: item.original_scope_description || null,
      })),
    };

    try {
      if (initialData?.id) {
        await updateChangeOrder.mutateAsync({ id: initialData.id, ...data });
        navigate(`/change-orders/${initialData.id}`);
      } else {
        const result = await addChangeOrder.mutateAsync(data);
        navigate(`/change-orders/${result.id}`);
      }
    } catch (error) {
      // Error handled in mutation
    }
  };

  const filteredJobOrders = jobOrders?.filter((jo) => !projectId || jo.project_id === projectId);
  const filteredPurchaseOrders = purchaseOrders?.filter((po) => !projectId || po.project_id === projectId);

  // Filtered lists for comboboxes
  const filteredProjects = projects?.filter(p =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase())
  ) || [];
  const filteredCustomers = customers?.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
  ) || [];
  const filteredVendors = vendors?.filter(v =>
    v.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
    v.specialty?.toLowerCase().includes(vendorSearch.toLowerCase())
  ) || [];
  const searchFilteredPOs = filteredPurchaseOrders?.filter(po =>
    po.number.toLowerCase().includes(poSearch.toLowerCase()) ||
    po.vendor_name?.toLowerCase().includes(poSearch.toLowerCase())
  ) || [];
  const searchFilteredJOs = filteredJobOrders?.filter(jo =>
    jo.number.toLowerCase().includes(joSearch.toLowerCase())
  ) || [];
  const filteredProducts = products?.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  ) || [];

  const selectedProject = projects?.find(p => p.id === projectId);
  const selectedCustomer = customers?.find(c => c.id === customerId);
  const selectedVendor = vendors?.find(v => v.id === vendorId);
  const selectedPO = purchaseOrders?.find(po => po.id === purchaseOrderId);
  const selectedJO = jobOrders?.find(jo => jo.id === jobOrderId);
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Change Order Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project">Project *</Label>
              <Popover open={projectOpen} onOpenChange={setProjectOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn("w-full justify-between", !projectId && "text-muted-foreground")}
                  >
                    {selectedProject?.name || "Search projects..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search projects..." value={projectSearch} onValueChange={setProjectSearch} />
                    <CommandList>
                      <CommandEmpty>No projects found.</CommandEmpty>
                      <CommandGroup>
                        {filteredProjects.map((project) => (
                          <CommandItem
                            key={project.id}
                            value={project.name}
                            onSelect={() => {
                              setProjectId(project.id);
                              setProjectOpen(false);
                              setProjectSearch("");
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", projectId === project.id ? "opacity-100" : "opacity-0")} />
                            {project.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer">Customer *</Label>
              <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn("w-full justify-between", !customerId && "text-muted-foreground")}
                  >
                    {selectedCustomer?.company || selectedCustomer?.name || "Search customers..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search customers..." value={customerSearch} onValueChange={setCustomerSearch} />
                    <CommandList>
                      <CommandEmpty>No customers found.</CommandEmpty>
                      <CommandGroup>
                        {filteredCustomers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={`${customer.name} ${customer.company || ''}`}
                            onSelect={() => {
                              setCustomerId(customer.id);
                              setCustomerName(customer.company || customer.name);
                              setCustomerOpen(false);
                              setCustomerSearch("");
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", customerId === customer.id ? "opacity-100" : "opacity-0")} />
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor (Optional)</Label>
              <Popover open={vendorOpen} onOpenChange={setVendorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn("w-full justify-between", !vendorId && "text-muted-foreground")}
                  >
                    {selectedVendor ? (
                      <div className="flex flex-col items-start text-left">
                        <span>{selectedVendor.name}</span>
                        {selectedVendor.specialty && (
                          <span className="text-xs text-muted-foreground">{selectedVendor.specialty}</span>
                        )}
                      </div>
                    ) : (
                      "Search vendors..."
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search vendors..." value={vendorSearch} onValueChange={setVendorSearch} />
                    <CommandList>
                      <CommandEmpty>No vendors found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="none"
                          onSelect={() => {
                            setVendorId("");
                            setVendorName("");
                            setVendorOpen(false);
                            setVendorSearch("");
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", !vendorId ? "opacity-100" : "opacity-0")} />
                          None
                        </CommandItem>
                        {filteredVendors.map((vendor) => (
                          <CommandItem
                            key={vendor.id}
                            value={`${vendor.name} ${vendor.specialty || ''}`}
                            onSelect={() => {
                              setVendorId(vendor.id);
                              setVendorName(vendor.name);
                              setVendorOpen(false);
                              setVendorSearch("");
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", vendorId === vendor.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span>{vendor.name}</span>
                              {vendor.specialty && (
                                <span className="text-xs text-muted-foreground">{vendor.specialty}</span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchaseOrder">Link to Purchase Order (Optional)</Label>
              <Popover open={poOpen} onOpenChange={setPOOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn("w-full justify-between", !purchaseOrderId && "text-muted-foreground")}
                  >
                    {selectedPO ? (
                      <div className="flex flex-col items-start text-left">
                        <span>{selectedPO.number}</span>
                        {selectedPO.vendor_name && (
                          <span className="text-xs text-muted-foreground">{selectedPO.vendor_name}</span>
                        )}
                      </div>
                    ) : (
                      "Search POs..."
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search POs..." value={poSearch} onValueChange={setPOSearch} />
                    <CommandList>
                      <CommandEmpty>No POs found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="none"
                          onSelect={() => {
                            setPurchaseOrderId("");
                            setPOOpen(false);
                            setPOSearch("");
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", !purchaseOrderId ? "opacity-100" : "opacity-0")} />
                          None
                        </CommandItem>
                        {searchFilteredPOs.map((po) => (
                          <CommandItem
                            key={po.id}
                            value={`${po.number} ${po.vendor_name || ''}`}
                            onSelect={() => {
                              setPurchaseOrderId(po.id);
                              setPOOpen(false);
                              setPOSearch("");
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", purchaseOrderId === po.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span>{po.number}</span>
                              {po.vendor_name && (
                                <span className="text-xs text-muted-foreground">{po.vendor_name}</span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobOrder">Link to Job Order (Optional)</Label>
              <Popover open={joOpen} onOpenChange={setJOOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn("w-full justify-between", !jobOrderId && "text-muted-foreground")}
                  >
                    {selectedJO?.number || "Search Job Orders..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search Job Orders..." value={joSearch} onValueChange={setJOSearch} />
                    <CommandList>
                      <CommandEmpty>No Job Orders found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="none"
                          onSelect={() => {
                            setJobOrderId("");
                            setJOOpen(false);
                            setJOSearch("");
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", !jobOrderId ? "opacity-100" : "opacity-0")} />
                          None
                        </CommandItem>
                        {searchFilteredJOs.map((jo) => (
                          <CommandItem
                            key={jo.id}
                            value={jo.number}
                            onSelect={() => {
                              setJobOrderId(jo.id);
                              setJOOpen(false);
                              setJOSearch("");
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", jobOrderId === jo.id ? "opacity-100" : "opacity-0")} />
                            {jo.number}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxRate">Tax Rate (%)</Label>
              <CalculatorInput
                value={taxRate}
                onValueChange={(value) => setTaxRate(value)}
                decimalPlaces={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="changeType">Change Type *</Label>
              <Select value={changeType} onValueChange={(v) => setChangeType(v as ChangeType)} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="additive">Additive (Add to Contract)</SelectItem>
                  <SelectItem value="deductive">Deductive (Credit)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Change Order *</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Additional electrical work requested by client"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Additional Notes</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details about this change order..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Scope Reduction Details - Required for Deductive COs */}
      {changeType === 'deductive' && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Scope Reduction Details (Required)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="scopeReference">Reference Original Scope *</Label>
              <Textarea
                id="scopeReference"
                value={scopeReference}
                onChange={(e) => setScopeReference(e.target.value)}
                placeholder="Describe the original scope items being removed (e.g., 'Remove 200 LF of copper flashing per RFI #12 - Owner directed change')"
                required
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This reference is required for audit purposes and will appear on PDFs and exports.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Line Items
            {isReadOnly && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Read-only access</TooltipContent>
              </Tooltip>
            )}
          </CardTitle>
          {canEditLineItems && (
            <Button type="button" variant="outline" size="sm" onClick={addLineItem} disabled={isReadOnly}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Product</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[80px]">Qty</TableHead>
                  <TableHead className="w-[110px]">Client Price</TableHead>
                  {canViewCosts && <TableHead className="w-[110px]">Vendor Cost</TableHead>}
                  {canViewMargins && <TableHead className="w-[80px]">Markup %</TableHead>}
                  <TableHead className="w-[120px]">Total</TableHead>
                  <TableHead className="w-[70px]">Taxable</TableHead>
                  <TableHead className="w-[50px]">Mode</TableHead>
                  {canEditLineItems && <TableHead className="w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TooltipProvider>
                  {lineItems.map((item, index) => (
                    <>
                      <TableRow key={item.id}>
                        <TableCell>
                          <Popover 
                            open={productOpenIndex === index} 
                            onOpenChange={(open) => {
                              setProductOpenIndex(open ? index : null);
                              if (!open) setProductSearch("");
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn("w-full justify-between", !item.product_id && "text-muted-foreground")}
                              >
                                <span className="truncate">
                                  {products?.find(p => p.id === item.product_id)?.name || "Select..."}
                                </span>
                                <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[250px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Search products..." value={productSearch} onValueChange={setProductSearch} />
                                <CommandList>
                                  <CommandEmpty>No products found.</CommandEmpty>
                                  <CommandGroup>
                                    {filteredProducts.map((product) => (
                                      <CommandItem
                                        key={product.id}
                                        value={product.name}
                                        onSelect={() => {
                                          selectProduct(index, product.id);
                                          setProductOpenIndex(null);
                                          setProductSearch("");
                                        }}
                                      >
                                        <Check className={cn("mr-2 h-4 w-4", item.product_id === product.id ? "opacity-100" : "opacity-0")} />
                                        <div className="flex flex-col">
                                          <span>{product.name}</span>
                                          <span className="text-xs text-muted-foreground">${product.cost.toFixed(2)}</span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.description}
                            onChange={(e) => updateLineItem(index, "description", e.target.value)}
                            placeholder="Description"
                          />
                        </TableCell>
                        <TableCell>
                          <CalculatorInput
                            value={item.quantity}
                            onValueChange={(value) => updateLineItem(index, "quantity", value)}
                            decimalPlaces={2}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="relative">
                            <CalculatorInput
                              value={item.unit_price}
                              onValueChange={(value) => updateLineItem(index, "unit_price", value)}
                              placeholder="0.00"
                              className={item.calculation_mode === 'reverse' ? 'bg-muted/50' : ''}
                            />
                            {item.calculation_mode === 'reverse' && (
                              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
                            )}
                          </div>
                        </TableCell>
                        {canViewCosts && (
                          <TableCell>
                            <CalculatorInput
                              value={item.vendor_cost}
                              onValueChange={(value) => updateLineItem(index, "vendor_cost", value)}
                              placeholder="0.00"
                              disabled={isReadOnly}
                            />
                          </TableCell>
                        )}
                        {canViewMargins && (
                          <TableCell>
                            <CalculatorInput
                              value={item.markup}
                              onValueChange={(value) => updateLineItem(index, "markup", value)}
                              decimalPlaces={2}
                              disabled={isReadOnly}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="relative">
                            <CalculatorInput
                              value={item.total}
                              onValueChange={(value) => updateLineItem(index, "total", value)}
                              decimalPlaces={2}
                              className={item.calculation_mode === 'forward' ? 'bg-muted/50' : ''}
                            />
                            {item.calculation_mode === 'forward' && (
                              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={item.is_taxable}
                            onChange={(e) => updateLineItem(index, "is_taxable", e.target.checked)}
                            className="h-4 w-4"
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant={item.calculation_mode === 'reverse' ? 'secondary' : 'ghost'}
                                size="icon"
                                onClick={() => toggleCalculationMode(index)}
                                className="h-8 w-8"
                              >
                                <ArrowRightLeft className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">
                                {item.calculation_mode === 'forward' 
                                  ? 'Forward: Unit Price → Total' 
                                  : 'Reverse: Total → Unit Price'}
                              </p>
                              <p className="text-xs text-muted-foreground">Click to toggle</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        {canEditLineItems && (
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLineItem(index)}
                              disabled={isReadOnly}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                      {/* Calculation breakdown row */}
                      <TableRow key={`${item.id}-breakdown`} className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={canViewCosts && canViewMargins ? 10 : (canViewCosts || canViewMargins ? 9 : 8)} className="py-1 text-xs text-muted-foreground">
                          <span className="ml-2">
                            {formatCalculationBreakdown(item)}
                          </span>
                        </TableCell>
                      </TableRow>
                    </>
                  ))}
                </TooltipProvider>
                {lineItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canViewCosts && canViewMargins ? 10 : (canViewCosts || canViewMargins ? 9 : 8)} className="text-center text-muted-foreground py-8">
                      No line items added. {canEditLineItems ? 'Click "Add Item" to add products or services.' : 'You do not have permission to add items.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-80 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Client Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax ({taxRate}%):</span>
                <span>${taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg border-t pt-2">
                <span>Client Total:</span>
                <span>${total.toFixed(2)}</span>
              </div>
              {canViewCosts && (
                <div className="flex justify-between text-sm text-muted-foreground pt-2 border-t">
                  <span>Vendor Cost Total:</span>
                  <span>${vendorCostTotal.toFixed(2)}</span>
                </div>
              )}
              {canViewMargins && (
                <div className="flex justify-between text-sm font-medium text-green-600">
                  <span>Gross Profit:</span>
                  <span>${grossProfit.toFixed(2)} ({marginPercent.toFixed(1)}%)</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between gap-4">
        {/* Left side - Revert button */}
        <div>
          {initialData?.id && hasUnsavedChanges && !isReadOnly && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowRevertDialog(true)}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Revert Changes
            </Button>
          )}
        </div>

        {/* Right side - Cancel and Save buttons */}
        <div className="flex gap-4">
          <Button type="button" variant="outline" onClick={handleCancel}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          {!isReadOnly && (
            <Button
              type="submit"
              disabled={addChangeOrder.isPending || updateChangeOrder.isPending || isReadOnly}
            >
              <Save className="mr-2 h-4 w-4" />
              {initialData?.id ? "Update" : "Create"} Change Order
            </Button>
          )}
        </div>
      </div>

      {/* Leave Confirmation Dialog */}
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

      {/* Revert Confirmation Dialog */}
      <AlertDialog open={showRevertDialog} onOpenChange={setShowRevertDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert All Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to discard all unsaved changes? This will restore the form to its original state. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Keep Editing
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRevertChanges} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revert Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
