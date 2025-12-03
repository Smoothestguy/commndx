import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Trash2, Plus, Copy, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useJobOrders, useJobOrder } from "@/integrations/supabase/hooks/useJobOrders";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuickBooksConfig, useQuickBooksNextNumber } from "@/integrations/supabase/hooks/useQuickBooks";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
  description: string;
  quantity: number;
  unitPrice: number;
  margin: number;
  total: number;
}

interface InvoiceFormProps {
  onSubmit: (data: any) => void;
  initialData?: any;
  jobOrderId?: string;
}

export function InvoiceForm({ onSubmit, initialData, jobOrderId }: InvoiceFormProps) {
  const { data: jobOrders = [], isLoading: jobOrdersLoading } = useJobOrders();
  const { data: customers = [], isLoading: customersLoading } = useCustomers();
  const [invoiceType, setInvoiceType] = useState<"job_order" | "customer">(jobOrderId ? "job_order" : "job_order");
  const [selectedJobOrderId, setSelectedJobOrderId] = useState<string | undefined>(jobOrderId);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>();
  const { data: jobOrderWithLineItems } = useJobOrder(selectedJobOrderId || "");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: "1", description: "", quantity: 1, unitPrice: 0, margin: 0, total: 0 },
  ]);
  const [selectedJobOrder, setSelectedJobOrder] = useState<any>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [dueDate, setDueDate] = useState<Date>();

  // QuickBooks integration
  const { data: qbConfig } = useQuickBooksConfig();
  const isQBConnected = qbConfig?.is_connected ?? false;
  const { data: qbNextNumber, isLoading: qbNumberLoading } = useQuickBooksNextNumber('invoice', isQBConnected);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      number: initialData?.number || `INV-${Date.now()}`,
      invoiceType: jobOrderId ? "job_order" : "job_order",
      jobOrderId: jobOrderId || initialData?.jobOrderId || "",
      customerId: initialData?.customerId || "",
      projectName: initialData?.projectName || "",
      dueDate: initialData?.dueDate || "",
      taxRate: initialData?.taxRate || 0,
      status: initialData?.status || "draft",
    },
  });

  // Set QuickBooks number when available
  useEffect(() => {
    if (qbNextNumber && !initialData?.number) {
      form.setValue("number", qbNextNumber);
    }
  }, [qbNextNumber, initialData?.number]);

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
      const copiedItems = jobOrderWithLineItems.line_items.map((item: any, index: number) => ({
        id: `${Date.now()}-${index}`,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        margin: item.markup,
        total: item.total,
      }));
      setLineItems(copiedItems);
      form.setValue("taxRate", jobOrderWithLineItems.tax_rate);
    }
  }, [jobOrderWithLineItems, invoiceType]);

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
      setLineItems([{ id: "1", description: "", quantity: 1, unitPrice: 0, margin: 0, total: 0 }]);
    }
  };

  const handleJobOrderChange = (value: string) => {
    setSelectedJobOrderId(value);
    form.setValue("jobOrderId", value);
    const jobOrder = jobOrders.find((jo: any) => jo.id === value);
    setSelectedJobOrder(jobOrder);
    if (jobOrder) {
      form.setValue("taxRate", jobOrder.tax_rate);
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
      const copiedItems = jobOrderWithLineItems.line_items.map((item: any, index: number) => ({
        id: `${Date.now()}-${index}`,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        margin: item.markup,
        total: item.total,
      }));
      setLineItems(copiedItems);
    }
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: Date.now().toString(), description: "", quantity: 1, unitPrice: 0, margin: 0, total: 0 },
    ]);
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
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const remainingBalance = selectedJobOrder ? selectedJobOrder.remaining_amount : 0;
  const exceedsBalance = invoiceType === "job_order" && total > remainingBalance;

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    if (invoiceType === "job_order" && exceedsBalance) {
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
      line_items: lineItems.map(({ id, ...item }) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        markup: item.margin,
        total: item.total,
      })),
    };

    if (invoiceType === "job_order") {
      onSubmit({
        ...baseData,
        job_order_id: values.jobOrderId,
        job_order_number: selectedJobOrder?.number,
        customer_id: selectedJobOrder?.customer_id,
        customer_name: selectedJobOrder?.customer_name,
        project_name: selectedJobOrder?.project_name,
      });
    } else {
      onSubmit({
        ...baseData,
        job_order_id: null,
        job_order_number: null,
        customer_id: selectedCustomer?.id,
        customer_name: selectedCustomer?.name,
        project_name: values.projectName || null,
      });
    }
  };

  const isLoading = jobOrdersLoading || customersLoading;

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pb-24">
      {/* Invoice Type Toggle */}
      <Card className="p-4">
        <Label className="text-base font-semibold mb-3 block">Invoice Type</Label>
        <RadioGroup
          value={invoiceType}
          onValueChange={(value) => handleInvoiceTypeChange(value as "job_order" | "customer")}
          className="flex flex-col sm:flex-row gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="job_order" id="job_order" />
            <Label htmlFor="job_order" className="cursor-pointer">From Job Order</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="customer" id="customer" />
            <Label htmlFor="customer" className="cursor-pointer">Direct to Customer</Label>
          </div>
        </RadioGroup>
      </Card>

      <Card className="p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Label htmlFor="number">Invoice Number</Label>
              {isQBConnected && (
                <Badge variant="outline" className="text-xs">
                  {qbNumberLoading ? (
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

          {/* Conditional: Job Order or Customer Selection */}
          {invoiceType === "job_order" ? (
            <div>
              <Label htmlFor="jobOrderId">Job Order</Label>
              <Select
                value={form.watch("jobOrderId")}
                onValueChange={handleJobOrderChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select job order" />
                </SelectTrigger>
                <SelectContent>
                  {jobOrders.map((jo: any) => (
                    <SelectItem key={jo.id} value={jo.id}>
                      {jo.number} - {jo.customer_name} ({jo.project_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.jobOrderId && (
                <p className="text-destructive text-sm mt-1">{form.formState.errors.jobOrderId.message}</p>
              )}
            </div>
          ) : (
            <div>
              <Label htmlFor="customerId">Customer</Label>
              <Select
                value={form.watch("customerId")}
                onValueChange={handleCustomerChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.company ? `(${c.company})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.customerId && (
                <p className="text-destructive text-sm mt-1">{form.formState.errors.customerId.message}</p>
              )}
            </div>
          )}

          {/* Project Name - only for direct customer invoices */}
          {invoiceType === "customer" && (
            <div>
              <Label htmlFor="projectName">Project Name (Optional)</Label>
              <Input
                id="projectName"
                {...form.register("projectName")}
                placeholder="Enter project name"
              />
            </div>
          )}

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

      {/* Customer Summary - only show for direct customer invoices */}
      {invoiceType === "customer" && selectedCustomer && (
        <Card className="p-4 bg-muted/50">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Customer:</span>
              <span className="font-medium">{selectedCustomer.name}</span>
            </div>
            {selectedCustomer.company && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Company:</span>
                <span className="font-medium">{selectedCustomer.company}</span>
              </div>
            )}
            {selectedCustomer.email && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{selectedCustomer.email}</span>
              </div>
            )}
            {selectedCustomer.tax_exempt && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax Status:</span>
                <Badge variant="secondary">Tax Exempt</Badge>
              </div>
            )}
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

      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-lg font-semibold">Line Items</Label>
            <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </div>
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
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={item.description}
                  onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                  placeholder="Item description"
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
                  <Input
                    type="number"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateLineItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                  />
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
      </div>

      <Card className="p-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span className="font-semibold">${subtotal.toFixed(2)}</span>
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
            <span className="font-semibold">${taxAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t pt-2">
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </Card>

      <Button type="submit" disabled={invoiceType === "job_order" && exceedsBalance} className="w-full sm:w-auto">
        Create Invoice
      </Button>
    </form>
  );
}
