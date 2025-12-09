import { useState, useEffect } from "react";
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Change Order Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project">Project *</Label>
              <Select value={projectId} onValueChange={setProjectId} required>
                <SelectTrigger>
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
              <Label htmlFor="customer">Customer *</Label>
              <Select value={customerId} onValueChange={(v) => {
                setCustomerId(v);
                const customer = customers?.find((c) => c.id === v);
                if (customer) setCustomerName(customer.name);
              }} required>
                <SelectTrigger>
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
              <Label htmlFor="vendor">Vendor (Optional)</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {vendors?.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchaseOrder">Link to Purchase Order (Optional)</Label>
              <Select value={purchaseOrderId} onValueChange={setPurchaseOrderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select PO" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {filteredPurchaseOrders?.map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobOrder">Link to Job Order (Optional)</Label>
              <Select value={jobOrderId} onValueChange={setJobOrderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Job Order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {filteredJobOrders?.map((jo) => (
                    <SelectItem key={jo.id} value={jo.id}>
                      {jo.number}
                    </SelectItem>
                  ))}
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
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              />
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Line Items</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Product</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[100px]">Qty</TableHead>
                  <TableHead className="w-[120px]">Unit Price</TableHead>
                  <TableHead className="w-[100px]">Markup %</TableHead>
                  <TableHead className="w-[120px]">Total</TableHead>
                  <TableHead className="w-[80px]">Taxable</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Select
                        value={item.product_id || ""}
                        onValueChange={(v) => selectProduct(index, v)}
                      >
                        <SelectTrigger className="w-full">
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
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(index, "quantity", parseFloat(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateLineItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.markup}
                        onChange={(e) => updateLineItem(index, "markup", parseFloat(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      ${item.total.toFixed(2)}
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {lineItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No line items added. Click "Add Item" to add products or services.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax ({taxRate}%):</span>
                <span>${taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg border-t pt-2">
                <span>Total:</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={addChangeOrder.isPending || updateChangeOrder.isPending}
        >
          <Save className="mr-2 h-4 w-4" />
          {initialData?.id ? "Update" : "Create"} Change Order
        </Button>
      </div>
    </form>
  );
}
