import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Save, X } from "lucide-react";
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
} from "@/integrations/supabase/hooks/useChangeOrders";

interface LineItem {
  id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  markup: number;
  total: number;
  is_taxable: boolean;
  sort_order: number;
}

interface ChangeOrderFormProps {
  initialData?: ChangeOrderWithLineItems;
  defaultProjectId?: string;
  defaultPurchaseOrderId?: string;
}

export function ChangeOrderForm({
  initialData,
  defaultProjectId,
  defaultPurchaseOrderId,
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
  const [lineItems, setLineItems] = useState<LineItem[]>(
    initialData?.line_items?.map((item) => ({
      ...item,
      id: item.id,
    })) || []
  );

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
        markup: 0,
        total: 0,
        is_taxable: true,
        sort_order: lineItems.length,
      },
    ]);
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: unknown) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

    // Recalculate total
    if (field === "quantity" || field === "unit_price" || field === "markup") {
      const qty = field === "quantity" ? (value as number) : updated[index].quantity;
      const price = field === "unit_price" ? (value as number) : updated[index].unit_price;
      const markup = field === "markup" ? (value as number) : updated[index].markup;
      updated[index].total = qty * price * (1 + markup / 100);
    }

    setLineItems(updated);
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
  const taxableAmount = lineItems.filter((item) => item.is_taxable).reduce((sum, item) => sum + item.total, 0);
  const taxAmount = taxableAmount * (taxRate / 100);
  const total = subtotal + taxAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      line_items: lineItems.map((item, index) => ({
        ...item,
        sort_order: index,
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

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Card className="glass-card border-primary/10">
        <CardHeader className="pb-4 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-primary to-primary/50" />
            <CardTitle className="font-heading">Change Order Details</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project" className="text-foreground/80">Project *</Label>
              <Select value={projectId} onValueChange={setProjectId} required>
                <SelectTrigger className="glass-input">
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

            <div className="space-y-2">
              <Label htmlFor="customer" className="text-foreground/80">Customer *</Label>
              <Select value={customerId} onValueChange={(v) => {
                setCustomerId(v);
                const customer = customers?.find((c) => c.id === v);
                if (customer) setCustomerName(customer.name);
              }} required>
                <SelectTrigger className="glass-input">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers?.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor" className="text-foreground/80">Vendor (Optional)</Label>
              <Select value={vendorId || "none"} onValueChange={(v) => setVendorId(v === "none" ? "" : v)}>
                <SelectTrigger className="glass-input">
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {vendors?.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchaseOrder" className="text-foreground/80">Link to Purchase Order (Optional)</Label>
              <Select value={purchaseOrderId || "none"} onValueChange={(v) => setPurchaseOrderId(v === "none" ? "" : v)}>
                <SelectTrigger className="glass-input">
                  <SelectValue placeholder="Select PO" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {filteredPurchaseOrders?.map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobOrder" className="text-foreground/80">Link to Job Order (Optional)</Label>
              <Select value={jobOrderId || "none"} onValueChange={(v) => setJobOrderId(v === "none" ? "" : v)}>
                <SelectTrigger className="glass-input">
                  <SelectValue placeholder="Select Job Order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {filteredJobOrders?.map((jo) => (
                    <SelectItem key={jo.id} value={jo.id}>
                      {jo.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxRate" className="text-foreground/80">Tax Rate (%)</Label>
              <CalculatorInput
                value={taxRate}
                onValueChange={(value) => setTaxRate(value)}
                decimalPlaces={2}
                className="glass-input"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason" className="text-foreground/80">Reason for Change Order *</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Additional electrical work requested by client"
              required
              className="glass-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-foreground/80">Additional Notes</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details about this change order..."
              rows={3}
              className="glass-input"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-primary/10">
        <CardHeader className="pb-4 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-primary to-primary/50" />
            <CardTitle className="font-heading">Line Items</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="glass-table-container overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/5 hover:bg-primary/5">
                  <TableHead className="w-[200px] font-medium">Product</TableHead>
                  <TableHead className="font-medium">Description</TableHead>
                  <TableHead className="w-[100px] font-medium">Qty</TableHead>
                  <TableHead className="w-[120px] font-medium">Unit Price</TableHead>
                  <TableHead className="w-[100px] font-medium">Markup %</TableHead>
                  <TableHead className="w-[120px] font-medium">Total</TableHead>
                  <TableHead className="w-[80px] font-medium">Taxable</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((item, index) => (
                  <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <Select
                        value={item.product_id || ""}
                        onValueChange={(v) => selectProduct(index, v)}
                      >
                        <SelectTrigger className="w-full glass-input">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {products?.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.description}
                        onChange={(e) => updateLineItem(index, "description", e.target.value)}
                        placeholder="Description"
                        className="glass-input"
                      />
                    </TableCell>
                    <TableCell>
                      <CalculatorInput
                        value={item.quantity}
                        onValueChange={(value) => updateLineItem(index, "quantity", value)}
                        decimalPlaces={2}
                        className="glass-input"
                      />
                    </TableCell>
                    <TableCell>
                      <CalculatorInput
                        value={item.unit_price}
                        onValueChange={(value) => updateLineItem(index, "unit_price", value)}
                        placeholder="0.00"
                        className="glass-input"
                      />
                    </TableCell>
                    <TableCell>
                      <CalculatorInput
                        value={item.markup}
                        onValueChange={(value) => updateLineItem(index, "markup", value)}
                        decimalPlaces={2}
                        className="glass-input"
                      />
                    </TableCell>
                    <TableCell className="font-semibold text-primary">
                      ${item.total.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={item.is_taxable}
                        onChange={(e) => updateLineItem(index, "is_taxable", e.target.checked)}
                        className="h-4 w-4 rounded border-border/50 text-primary focus:ring-primary/30"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(index)}
                        className="hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {lineItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                      No line items added. Click "Add Item" to add products or services.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <Button type="button" variant="outline" className="w-full glass-input hover:bg-primary/5 hover:border-primary/30" onClick={addLineItem}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>

          <div className="flex justify-end pt-4">
            <div className="glass-elevated w-72 space-y-3">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal:</span>
                <span className="text-foreground">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Tax ({taxRate}%):</span>
                <span className="text-foreground">${taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg border-t border-primary/20 pt-3">
                <span>Total:</span>
                <span className="text-primary">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4 pt-2">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => navigate(-1)}
          className="glass-input hover:bg-muted/50"
        >
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={addChangeOrder.isPending || updateChangeOrder.isPending}
          className="bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:from-primary/90 hover:to-primary/70 transition-all duration-300"
        >
          <Save className="mr-2 h-4 w-4" />
          {initialData?.id ? "Update" : "Create"} Change Order
        </Button>
      </div>
    </form>
  );
}
