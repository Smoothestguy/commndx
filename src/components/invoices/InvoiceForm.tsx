import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalculatorInput } from "@/components/ui/calculator-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Trash2, Plus, Copy, Loader2, Check, ChevronsUpDown, Receipt, Package, FileText } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useJobOrders, useJobOrder } from "@/integrations/supabase/hooks/useJobOrders";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { useProducts, Product } from "@/integrations/supabase/hooks/useProducts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuickBooksConfig } from "@/integrations/supabase/hooks/useQuickBooks";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useAuth } from "@/contexts/AuthContext";
import { PendingAttachmentsUpload, PendingFile } from "@/components/shared/PendingAttachmentsUpload";
import { cleanupPendingAttachments } from "@/utils/attachmentUtils";
import { toast } from "sonner";
import { getNextInvoiceNumber } from "@/utils/invoiceNumberGenerator";
import { BillableItemsSelector, useSelectedBillableItemsTotals } from "./BillableItemsSelector";
import { useProjectBillableItems } from "@/integrations/supabase/hooks/useProjectBillableItems";

const formSchema = z.object({
  number: z.string().min(1, "Invoice number is required"),
  invoiceType: z.enum(["job_order", "customer"]),
  jobOrderId: z.string().optional(),
  customerId: z.string().optional(),
  projectName: z.string().optional(),
  dueDate: z.string().min(1, "Due date is required"),
  taxRate: z.number().min(0).max(100),
  status: z.enum(["draft", "sent", "paid", "overdue"]),
}).refine((data) => {
  if (data.invoiceType === "job_order") {
    return !!data.jobOrderId && data.jobOrderId.length > 0;
  }
  return !!data.customerId && data.customerId.length > 0;
}, {
  message: "Please select a job order or customer",
  path: ["jobOrderId"],
});

interface LineItem {
  id: string;
  productId?: string;
  productName?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  margin: number;
  total: number;
  isTaxable: boolean;
  displayOrder?: number;
}

interface InvoiceFormProps {
  onSubmit: (data: any, pendingAttachments?: PendingFile[]) => void;
  onSubmitMultiItem?: (data: any, pendingAttachments?: PendingFile[]) => void;
  initialData?: any;
  jobOrderId?: string;
}

export function InvoiceForm({ onSubmit, onSubmitMultiItem, initialData, jobOrderId }: InvoiceFormProps) {
  const { user } = useAuth();
  const { data: jobOrders = [], isLoading: jobOrdersLoading } = useJobOrders();
  const { data: customers = [], isLoading: customersLoading } = useCustomers();
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const [invoiceType, setInvoiceType] = useState<"job_order" | "customer">(jobOrderId ? "job_order" : "job_order");
  const [selectedJobOrderId, setSelectedJobOrderId] = useState<string | undefined>(jobOrderId);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>();
  const { data: jobOrderWithLineItems } = useJobOrder(selectedJobOrderId || "");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: "1", productName: "", description: "", quantity: 1, unitPrice: 0, margin: 0, total: 0, isTaxable: true },
  ]);
  const [selectedJobOrder, setSelectedJobOrder] = useState<any>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [dueDate, setDueDate] = useState<Date>();
  const [customerComboboxOpen, setCustomerComboboxOpen] = useState(false);
  const [jobOrderComboboxOpen, setJobOrderComboboxOpen] = useState(false);
  const [productComboboxOpen, setProductComboboxOpen] = useState<Record<string, boolean>>({});

  // Pending attachments state
  const [pendingAttachments, setPendingAttachments] = useState<PendingFile[]>([]);

  // Search states for comboboxes
  const [customerSearch, setCustomerSearch] = useState("");
  const [jobOrderSearch, setJobOrderSearch] = useState("");
  const [productSearch, setProductSearch] = useState<Record<string, string>>({});

  // QuickBooks integration
  const { data: qbConfig } = useQuickBooksConfig();
  const isQBConnected = qbConfig?.is_connected ?? false;

  // Multi-item selection state - use array instead of Set for stable state
  const [selectedBillableItems, setSelectedBillableItems] = useState<string[]>([]);
  const [useMultiItemMode, setUseMultiItemMode] = useState(false);
  
  // Job Order billing mode: "summary" shows single line, "detailed" shows all JO line items
  const [jobOrderBillingMode, setJobOrderBillingMode] = useState<"summary" | "detailed">("detailed");
  
  // State for invoice number loading
  const [invoiceNumberLoading, setInvoiceNumberLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      number: initialData?.number || "",
      invoiceType: jobOrderId ? "job_order" : "job_order",
      jobOrderId: jobOrderId || initialData?.jobOrderId || "",
      customerId: initialData?.customerId || "",
      projectName: initialData?.projectName || "",
      dueDate: initialData?.dueDate || "",
      taxRate: initialData?.taxRate || 0,
      status: initialData?.status || "draft",
    },
  });

  // Fetch invoice number on mount (if not editing)
  useEffect(() => {
    if (initialData?.number) return; // Don't fetch if editing existing invoice
    
    const fetchNumber = async () => {
      setInvoiceNumberLoading(true);
      try {
        const result = await getNextInvoiceNumber();
        form.setValue("number", result.number);
      } catch (error) {
        console.error("Failed to fetch invoice number:", error);
        toast.error("Failed to generate invoice number");
      } finally {
        setInvoiceNumberLoading(false);
      }
    };
    
    fetchNumber();
  }, [initialData?.number]);

  useEffect(() => {
    if (jobOrderId && jobOrders.length > 0) {
      const jobOrder = jobOrders.find((jo: any) => jo.id === jobOrderId);
      if (jobOrder) {
        setSelectedJobOrder(jobOrder);
        form.setValue("jobOrderId", jobOrderId);
        form.setValue("taxRate", jobOrder.tax_rate);
      }
    }
  }, [jobOrderId, jobOrders]);

  useEffect(() => {
    if (invoiceType === "job_order" && jobOrderWithLineItems?.line_items?.length > 0) {
      setSelectedJobOrder(jobOrderWithLineItems);
      const copiedItems = jobOrderWithLineItems.line_items.map((item: any, index: number) => {
        // Try to infer product from description if product_id is missing
        let productId = item.product_id;
        let productName = item.product_name || "";
        
        if (!productId && item.description && products.length > 0) {
          // Try exact match by description
          const matchedProduct = products.find(
            (p) => p.name.toLowerCase().trim() === item.description.toLowerCase().trim()
          );
          if (matchedProduct) {
            productId = matchedProduct.id;
            productName = matchedProduct.name;
          }
        }
        
        return {
          id: `${Date.now()}-${index}`,
          productId: productId || undefined,
          productName,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          margin: item.markup,
          total: item.total,
          isTaxable: item.is_taxable ?? true,
          displayOrder: index,
        };
      });
      setLineItems(copiedItems);
      form.setValue("taxRate", jobOrderWithLineItems.tax_rate);
    }
  }, [jobOrderWithLineItems, invoiceType, products]);

  const handleInvoiceTypeChange = (value: "job_order" | "customer") => {
    setInvoiceType(value);
    form.setValue("invoiceType", value);
    
    // Reset selections when switching
    if (value === "job_order") {
      setSelectedCustomerId(undefined);
      setSelectedCustomer(null);
      form.setValue("customerId", "");
      form.setValue("projectName", "");
    } else {
      setSelectedJobOrderId(undefined);
      setSelectedJobOrder(null);
      form.setValue("jobOrderId", "");
      // Reset line items to empty when switching to customer mode
      setLineItems([{ id: "1", productName: "", description: "", quantity: 1, unitPrice: 0, margin: 0, total: 0, isTaxable: true }]);
    }
  };

  const handleJobOrderChange = (value: string) => {
    setSelectedJobOrderId(value);
    form.setValue("jobOrderId", value);
    const jobOrder = jobOrders.find((jo: any) => jo.id === value);
    setSelectedJobOrder(jobOrder);
    if (jobOrder) {
      form.setValue("taxRate", jobOrder.tax_rate);
      // Auto-select this job order in billable items and enable multi-item mode
      setSelectedBillableItems([value]);
      setUseMultiItemMode(true);
    }
  };

  const handleCustomerChange = (value: string) => {
    setSelectedCustomerId(value);
    form.setValue("customerId", value);
    const customer = customers.find((c: any) => c.id === value);
    setSelectedCustomer(customer);
    // If customer is tax exempt, set tax rate to 0
    if (customer?.tax_exempt) {
      form.setValue("taxRate", 0);
    }
  };

  const copyFromJobOrder = () => {
    if (jobOrderWithLineItems?.line_items?.length > 0) {
      const copiedItems = jobOrderWithLineItems.line_items.map((item: any, index: number) => {
        // Try to infer product from description if product_id is missing
        let productId = item.product_id;
        let productName = item.product_name || "";
        
        if (!productId && item.description && products.length > 0) {
          // Try exact match by description
          const matchedProduct = products.find(
            (p) => p.name.toLowerCase().trim() === item.description.toLowerCase().trim()
          );
          if (matchedProduct) {
            productId = matchedProduct.id;
            productName = matchedProduct.name;
          }
        }
        
        return {
          id: `${Date.now()}-${index}`,
          productId: productId || undefined,
          productName,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          margin: item.markup,
          total: item.total,
          isTaxable: item.is_taxable ?? true,
          displayOrder: index,
        };
      });
      setLineItems(copiedItems);
    }
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: Date.now().toString(), productId: undefined, productName: "", description: "", quantity: 1, unitPrice: 0, margin: 0, total: 0, isTaxable: true },
    ]);
  };

  const handleProductSelect = (lineItemId: string, product: Product) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id === lineItemId) {
          const baseTotal = item.quantity * product.cost;
          const total = product.markup > 0 && product.markup < 100
            ? baseTotal / (1 - product.markup / 100)
            : baseTotal;
          return {
            ...item,
            productId: product.id,
            productName: product.name,
            description: product.description || "",
            unitPrice: product.cost,
            margin: product.markup,
            total,
            isTaxable: true, // Default new products to taxable
          };
        }
        return item;
      })
    );
    setProductComboboxOpen((prev) => ({ ...prev, [lineItemId]: false }));
  };

  const getProductsByType = (type: 'product' | 'service' | 'labor') => {
    return products.filter((p) => p.item_type === type);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((item) => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === "quantity" || field === "unitPrice" || field === "margin") {
            const baseTotal = updated.quantity * updated.unitPrice;
            updated.total = updated.margin > 0 && updated.margin < 100 
              ? baseTotal / (1 - updated.margin / 100) 
              : baseTotal;
          }
          return updated;
        }
        return item;
      })
    );
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxRate = form.watch("taxRate") || 0;
  // Only apply tax to taxable line items
  const taxableSubtotal = lineItems
    .filter((item) => item.isTaxable)
    .reduce((sum, item) => sum + item.total, 0);
  const taxAmount = Math.round(taxableSubtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  // Get billable items totals for multi-item mode
  const billableItemsTotals = useSelectedBillableItemsTotals(
    selectedJobOrder?.project_id,
    selectedBillableItems,
    taxRate,
    jobOrderBillingMode,
    jobOrderWithLineItems
  );

  // Determine which totals to use based on mode
  const effectiveSubtotal = useMultiItemMode && selectedBillableItems.length > 0 ? billableItemsTotals.subtotal : subtotal;
  const effectiveTaxAmount = useMultiItemMode && selectedBillableItems.length > 0 ? billableItemsTotals.taxAmount : taxAmount;
  const effectiveTotal = useMultiItemMode && selectedBillableItems.length > 0 ? billableItemsTotals.total : total;

  const remainingBalance = selectedJobOrder ? selectedJobOrder.remaining_amount : 0;
  // Add small tolerance for rounding differences - only check in non-multi-item mode
  const exceedsBalance = invoiceType === "job_order" && !useMultiItemMode && total > remainingBalance + 0.01;

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    if (invoiceType === "job_order" && !useMultiItemMode && exceedsBalance) {
      return;
    }

    // Multi-item mode: use billable items for line items and submit via onSubmitMultiItem
    if (invoiceType === "job_order" && useMultiItemMode && selectedBillableItems.length > 0 && onSubmitMultiItem) {
      onSubmitMultiItem({
        number: values.number,
        project_id: selectedJobOrder?.project_id,
        project_name: selectedJobOrder?.project_name,
        customer_id: selectedJobOrder?.customer_id,
        customer_name: selectedJobOrder?.customer_name,
        status: values.status,
        subtotal: billableItemsTotals.subtotal,
        tax_rate: taxRate,
        tax_amount: billableItemsTotals.taxAmount,
        total: billableItemsTotals.total,
        due_date: values.dueDate,
        line_items: billableItemsTotals.lineItems,
        job_order_ids: billableItemsTotals.jobOrderIds,
        change_order_ids: billableItemsTotals.changeOrderIds,
        tm_ticket_ids: billableItemsTotals.tmTicketIds,
      }, pendingAttachments);
      return;
    }

    const baseData = {
      number: values.number,
      status: values.status,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      due_date: values.dueDate,
      line_items: lineItems.map(({ id, ...item }, index) => ({
        product_id: item.productId || null,
        product_name: item.productName || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        markup: item.margin,
        total: item.total,
        display_order: index,
      })),
    };

    if (invoiceType === "job_order") {
      onSubmit({
        ...baseData,
        job_order_id: values.jobOrderId,
        job_order_number: selectedJobOrder?.number,
        project_id: selectedJobOrder?.project_id,
        customer_id: selectedJobOrder?.customer_id,
        customer_name: selectedJobOrder?.customer_name,
        project_name: selectedJobOrder?.project_name,
      }, pendingAttachments);
    } else {
      onSubmit({
        ...baseData,
        job_order_id: null,
        job_order_number: null,
        project_id: null,
        customer_id: selectedCustomer?.id,
        customer_name: selectedCustomer?.name,
        project_name: values.projectName || null,
      }, pendingAttachments);
    }
  };

  const isLoading = jobOrdersLoading || customersLoading || productsLoading;

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const onFormSubmit = form.handleSubmit(
    handleSubmit,
    (errors) => {
      console.log("Form validation errors:", errors);
      toast.error("Please fill in all required fields");
    }
  );

  return (
    <form onSubmit={onFormSubmit} className="space-y-4 pb-24">
      {/* Invoice Type Info */}
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Receipt className="h-4 w-4" />
          <span>Invoices must be created from a Job Order to track billing progress.</span>
        </div>
      </Card>

      <Card className="p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Label htmlFor="number">Invoice Number</Label>
              {isQBConnected && (
                <Badge variant="outline" className="text-xs">
                  {invoiceNumberLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : null}
                  QuickBooks
                </Badge>
              )}
            </div>
            <Input id="number" {...form.register("number")} />
            {form.formState.errors.number && (
              <p className="text-destructive text-sm mt-1">{form.formState.errors.number.message}</p>
            )}
          </div>

          {/* Job Order Selection with Search */}
          <div>
            <Label htmlFor="jobOrderId">Job Order</Label>
            <Popover open={jobOrderComboboxOpen} onOpenChange={setJobOrderComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={jobOrderComboboxOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedJobOrderId
                    ? (() => {
                        const jo = jobOrders.find((j: any) => j.id === selectedJobOrderId);
                        return jo ? `${jo.number} - ${jo.customer_name}` : "Select job order...";
                      })()
                    : "Search job order..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50 bg-popover" align="start">
                <Command>
                  <CommandInput 
                    placeholder="Search by number, customer, project..." 
                    value={jobOrderSearch}
                    onValueChange={setJobOrderSearch}
                  />
                  <CommandList>
                    <CommandEmpty>No job orders found.</CommandEmpty>
                    <CommandGroup>
                      {jobOrders.map((jo: any) => (
                        <CommandItem
                          key={jo.id}
                          value={`${jo.number} ${jo.customer_name} ${jo.project_name}`}
                          onSelect={() => {
                            handleJobOrderChange(jo.id);
                            setJobOrderComboboxOpen(false);
                            setJobOrderSearch("");
                            // Clear customer selection when job order is selected
                            setSelectedCustomer(null);
                            setSelectedCustomerId(undefined);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedJobOrderId === jo.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">{jo.number}</span>
                            <span className="text-xs text-muted-foreground">
                              {jo.customer_name} • {jo.project_name}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {form.formState.errors.jobOrderId && (
              <p className="text-destructive text-sm mt-1">{form.formState.errors.jobOrderId.message}</p>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>OR</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Customer Selection with Search (for direct invoices without job order) */}
          <div>
            <Label htmlFor="customerId">Customer (Direct Invoice)</Label>
            <Popover open={customerComboboxOpen} onOpenChange={setCustomerComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerComboboxOpen}
                  className="w-full justify-between font-normal"
                  disabled={!!selectedJobOrderId}
                >
                  {selectedCustomerId && !selectedJobOrderId
                    ? (() => {
                        const customer = customers?.find((c: any) => c.id === selectedCustomerId);
                        return customer ? (customer.company || customer.name) : "Search customer...";
                      })()
                    : selectedJobOrderId 
                      ? "Customer from Job Order"
                      : "Search customer..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50 bg-popover" align="start">
                <Command>
                  <CommandInput 
                    placeholder="Search by name or company..." 
                    value={customerSearch}
                    onValueChange={setCustomerSearch}
                  />
                  <CommandList>
                    <CommandEmpty>No customers found.</CommandEmpty>
                    <CommandGroup>
                      {customers?.map((customer: any) => (
                        <CommandItem
                          key={customer.id}
                          value={`${customer.name} ${customer.company || ''}`}
                          onSelect={() => {
                            handleCustomerChange(customer.id);
                            setCustomerComboboxOpen(false);
                            setCustomerSearch("");
                            // Clear job order selection when customer is selected directly
                            setSelectedJobOrderId(undefined);
                            setSelectedJobOrder(null);
                            form.setValue("jobOrderId", "");
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedCustomerId === customer.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">{customer.company || customer.name}</span>
                            {customer.company && customer.name && customer.company !== customer.name && (
                              <span className="text-xs text-muted-foreground">
                                {customer.name}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground mt-1">
              Select a customer directly for invoices without a job order
            </p>
          </div>

          <div>
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={(date) => {
                    setDueDate(date);
                    if (date) {
                      form.setValue("dueDate", format(date, "yyyy-MM-dd"));
                    }
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {form.formState.errors.dueDate && (
              <p className="text-destructive text-sm mt-1">{form.formState.errors.dueDate.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={form.watch("status")} onValueChange={(value: any) => form.setValue("status", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Job Order Summary - only show for job order invoices */}
      {invoiceType === "job_order" && selectedJobOrder && (
        <Card className="p-4 bg-muted/50">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Customer:</span>
              <span className="font-medium">{selectedJobOrder.customer_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Project:</span>
              <span className="font-medium">{selectedJobOrder.project_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Job Order Total:</span>
              <span className="font-medium">${selectedJobOrder.total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Already Invoiced:</span>
              <span className="font-medium">${selectedJobOrder.invoiced_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>Remaining Balance:</span>
              <span className="text-primary">${remainingBalance.toFixed(2)}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Project Details - show when job order with project info is selected */}
      {invoiceType === "job_order" && selectedJobOrder && (selectedJobOrder.project_description || selectedJobOrder.project_address || selectedJobOrder.project_poc_name) && (
        <Card className="p-4 bg-muted/50">
          <h4 className="font-medium mb-3 text-sm">Project Details</h4>
          <div className="space-y-2">
            {selectedJobOrder.project_description && (
              <div className="text-sm">
                <span className="text-muted-foreground">Scope: </span>
                <span>{selectedJobOrder.project_description}</span>
              </div>
            )}
            {selectedJobOrder.project_address && (
              <div className="text-sm">
                <span className="text-muted-foreground">Jobsite: </span>
                <span>
                  {selectedJobOrder.project_address}
                  {selectedJobOrder.project_city && `, ${selectedJobOrder.project_city}`}
                  {selectedJobOrder.project_state && `, ${selectedJobOrder.project_state}`}
                  {selectedJobOrder.project_zip && ` ${selectedJobOrder.project_zip}`}
                </span>
              </div>
            )}
            {selectedJobOrder.project_poc_name && (
              <div className="text-sm">
                <span className="text-muted-foreground">Contact: </span>
                <span>
                  {selectedJobOrder.project_poc_name}
                  {selectedJobOrder.project_poc_phone && ` • ${selectedJobOrder.project_poc_phone}`}
                  {selectedJobOrder.project_poc_email && ` • ${selectedJobOrder.project_poc_email}`}
                </span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Billable Items Selection - replaces Related Items section */}
      {invoiceType === "job_order" && selectedJobOrder && (
        <>
          <BillableItemsSelector
            projectId={selectedJobOrder?.project_id}
            selectedItems={selectedBillableItems}
            onSelectionChange={setSelectedBillableItems}
            preSelectedJobOrderId={selectedJobOrderId}
          />
          
          {/* Job Order Billing Mode Toggle */}
          {selectedBillableItems.length > 0 && billableItemsTotals.jobOrderIds.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Job Order Line Items</Label>
                  <p className="text-sm text-muted-foreground">
                    {jobOrderBillingMode === "detailed" 
                      ? "Showing all individual line items from the job order" 
                      : "Showing summary (remaining balance only)"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={jobOrderBillingMode === "detailed" ? "default" : "outline"}
                    onClick={() => setJobOrderBillingMode("detailed")}
                  >
                    Detailed
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={jobOrderBillingMode === "summary" ? "default" : "outline"}
                    onClick={() => setJobOrderBillingMode("summary")}
                  >
                    Summary
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Invoice Line Items Preview - show in multi-item mode */}
      {useMultiItemMode && selectedBillableItems.length > 0 && billableItemsTotals.lineItems.length > 0 && (
        <Card className="p-4">
          <Label className="text-base font-medium mb-3 block">Invoice Line Items Preview</Label>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Description</th>
                  <th className="text-right p-3 font-medium w-24">Qty</th>
                  <th className="text-right p-3 font-medium w-28">Unit Price</th>
                  <th className="text-right p-3 font-medium w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {billableItemsTotals.lineItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-muted/30">
                    <td className="p-3">
                      <div className="font-medium">{item.product_name}</div>
                      {item.description && (
                        <div className="text-muted-foreground text-xs">{item.description}</div>
                      )}
                    </td>
                    <td className="p-3 text-right">{item.quantity}</td>
                    <td className="p-3 text-right">${item.unit_price.toFixed(2)}</td>
                    <td className="p-3 text-right font-medium">${item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {exceedsBalance && (
        <Alert variant="destructive">
          <AlertDescription>
            Invoice total (${total.toFixed(2)}) exceeds remaining job order balance (${remainingBalance.toFixed(2)})
          </AlertDescription>
        </Alert>
      )}

      {/* Line Items Section - hidden when using multi-item mode */}
      {!(useMultiItemMode && selectedBillableItems.length > 0) && (
        <div className="space-y-4">
          <div className="space-y-3">
            <Label className="text-lg font-semibold">Line Items</Label>
            {invoiceType === "job_order" && selectedJobOrder && (
              <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={copyFromJobOrder}>
                <Copy className="w-4 h-4 mr-2" />
                Copy from Job Order
              </Button>
            )}
          </div>

          {lineItems.map((item, index) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Item {index + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLineItem(item.id)}
                  disabled={lineItems.length === 1}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              
              <div className="space-y-3">
                {/* Show Product Name prominently if it exists (from job order) */}
                {item.productName && !item.productId && (
                  <div className="space-y-2">
                    <Label>Product</Label>
                    <div className="h-10 flex items-center px-3 bg-muted rounded-md font-medium border">
                      {item.productName}
                    </div>
                  </div>
                )}

                {/* Product Selection - only show if no product name exists yet */}
                {(!item.productName || item.productId) && (
                  <div className="space-y-2">
                    <Label>Product (Optional)</Label>
                    <Popover
                      open={productComboboxOpen[item.id] || false}
                      onOpenChange={(open) =>
                        setProductComboboxOpen((prev) => ({ ...prev, [item.id]: open }))
                      }
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={productComboboxOpen[item.id] || false}
                          className="w-full justify-between font-normal"
                        >
                          {item.productId
                            ? products.find((p) => p.id === item.productId)?.name || item.productName || "Select product..."
                            : "Search products..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50 bg-popover" align="start">
                        <Command>
                          <CommandInput 
                            placeholder="Search by name, SKU, or category..." 
                            value={productSearch[item.id] || ""}
                            onValueChange={(v) => setProductSearch(prev => ({ ...prev, [item.id]: v }))}
                          />
                          <CommandList>
                            <CommandEmpty>No products found.</CommandEmpty>
                            {getProductsByType('product').length > 0 && (
                              <CommandGroup heading="Products">
                                {getProductsByType('product').map((product) => (
                                  <CommandItem
                                    key={product.id}
                                    value={`${product.name} ${product.sku || ""} ${product.category}`}
                                    onSelect={() => {
                                      handleProductSelect(item.id, product);
                                      setProductSearch(prev => ({ ...prev, [item.id]: "" }));
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        item.productId === product.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col">
                                      <span>{product.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {product.category} • ${product.price.toFixed(2)} / {product.unit}
                                      </span>
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
                                    value={`${product.name} ${product.sku || ""} ${product.category}`}
                                    onSelect={() => {
                                      handleProductSelect(item.id, product);
                                      setProductSearch(prev => ({ ...prev, [item.id]: "" }));
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        item.productId === product.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col">
                                      <span>{product.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {product.category} • ${product.price.toFixed(2)} / {product.unit}
                                      </span>
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
                                    value={`${product.name} ${product.sku || ""} ${product.category}`}
                                    onSelect={() => {
                                      handleProductSelect(item.id, product);
                                      setProductSearch(prev => ({ ...prev, [item.id]: "" }));
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        item.productId === product.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col">
                                      <span>{product.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {product.category} • ${product.price.toFixed(2)} / {product.unit}
                                      </span>
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
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Description</Label>
                    {item.productId && (
                      <Badge variant="outline" className="text-xs">
                        {products.find((p) => p.id === item.productId)?.unit}
                      </Badge>
                    )}
                  </div>
                  <Textarea
                    value={item.description}
                    onChange={(e) => {
                      updateLineItem(item.id, "description", e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    placeholder="Item description"
                    className="min-h-[80px] resize-none overflow-hidden"
                    ref={(el) => {
                      if (el) {
                        el.style.height = 'auto';
                        el.style.height = el.scrollHeight + 'px';
                      }
                    }}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit Price</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <CalculatorInput
                        value={item.unitPrice}
                        onValueChange={(value) => updateLineItem(item.id, "unitPrice", value)}
                        className="pl-7"
                        showCalculatorIcon={false}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Margin %</Label>
                    <Input
                      type="number"
                      step="0.01"
                      max="99.99"
                      value={item.margin}
                      onChange={(e) => updateLineItem(item.id, "margin", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Total</Label>
                    <div className="h-10 flex items-center px-3 bg-muted rounded-md font-semibold">
                      ${item.total.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
          
          <Button type="button" variant="outline" className="w-full" onClick={addLineItem}>
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>
      )}

      <Card className="p-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>
              Subtotal{useMultiItemMode && selectedBillableItems.length > 0 ? ` (${billableItemsTotals.selectedCount} items)` : ''}:
            </span>
            <span className="font-semibold">${effectiveSubtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span>Tax Rate:</span>
              <Input
                type="number"
                step="0.01"
                className="w-20"
                value={taxRate}
                onChange={(e) => form.setValue("taxRate", parseFloat(e.target.value) || 0)}
              />
              <span>%</span>
            </div>
            <span className="font-semibold">${effectiveTaxAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t pt-2">
            <span>Total:</span>
            <span>${effectiveTotal.toFixed(2)}</span>
          </div>
        </div>
      </Card>

      {/* Attachments Section */}
      {!initialData && (
        <PendingAttachmentsUpload
          entityType="invoice"
          pendingFiles={pendingAttachments}
          onFilesChange={setPendingAttachments}
        />
      )}

      <Button type="submit" disabled={invoiceType === "job_order" && exceedsBalance} className="w-full sm:w-auto">
        Create Invoice
      </Button>
    </form>
  );
}
