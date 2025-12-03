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
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { useProjectsByCustomer } from "@/integrations/supabase/hooks/useProjects";
import { useProducts } from "@/integrations/supabase/hooks/useProducts";
import { useAddEstimate } from "@/integrations/supabase/hooks/useEstimates";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { useQuickBooksConfig, useQuickBooksNextNumber } from "@/integrations/supabase/hooks/useQuickBooks";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";

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

export const EstimateForm = () => {
  const navigate = useNavigate();
  const { data: customers, isLoading: customersLoading } = useCustomers();
  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: companySettings } = useCompanySettings();
  const addEstimate = useAddEstimate();

  // QuickBooks integration
  const { data: qbConfig } = useQuickBooksConfig();
  const isQBConnected = qbConfig?.is_connected ?? false;
  const { data: qbNextNumber, isLoading: qbNumberLoading } = useQuickBooksNextNumber('estimate', isQBConnected);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [taxRate, setTaxRate] = useState<string>("8.25");
  const [validUntil, setValidUntil] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [status, setStatus] = useState<"draft" | "pending" | "sent" | "approved">("draft");
  const [defaultPricingType, setDefaultPricingType] = useState<'markup' | 'margin'>('margin');
  const [estimateNumber, setEstimateNumber] = useState<string>("");

  const { data: projects } = useProjectsByCustomer(selectedCustomerId);

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: "1", unit_price: "", margin: "0", pricing_type: "margin", is_taxable: true, total: 0 },
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Generate estimate number
  const generateEstimateNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `EST-${year}-${random}`;
  };

  // Set QuickBooks number when available
  useEffect(() => {
    if (qbNextNumber) {
      setEstimateNumber(qbNextNumber);
    } else if (!estimateNumber) {
      setEstimateNumber(generateEstimateNumber());
    }
  }, [qbNextNumber]);

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
        description: product.description || product.name,
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

  // Load default tax rate from company settings
  useEffect(() => {
    if (companySettings?.default_tax_rate) {
      setTaxRate(companySettings.default_tax_rate.toString());
    }
  }, [companySettings]);

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

    const estimateData = {
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
      lineItems: lineItems.map((item) => ({
        product_id: item.product_id,
        description: item.description,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
        markup: parseFloat(item.margin), // DB column is still "markup"
        pricing_type: item.pricing_type,
        is_taxable: item.is_taxable,
        total: item.total,
      })),
    };

    await addEstimate.mutateAsync(estimateData);
    navigate("/estimates");
  };

  // Set default valid until date (30 days from now)
  useEffect(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    setValidUntil(date.toISOString().split("T")[0]);
  }, []);

  if (customersLoading || productsLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
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
                      {customer.name} - {customer.company}
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading">Line Items</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
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

              <div className="space-y-2">
                <Label>Select Product (Optional)</Label>
                <Select
                  value={item.product_id || ""}
                  onValueChange={(value) => selectProduct(index, value)}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Select a product or enter manually" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} - ${product.price.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Description *</Label>
                  <Input
                    value={item.description}
                    onChange={(e) => updateLineItem(index, "description", e.target.value)}
                    placeholder="Item description"
                    className="bg-secondary border-border"
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
                  <Label>Unit Price ($) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => updateLineItem(index, "unit_price", e.target.value)}
                    className="bg-secondary border-border"
                  />
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
          disabled={addEstimate.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" variant="glow" disabled={addEstimate.isPending}>
          {addEstimate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Estimate
        </Button>
      </div>
    </form>
  );
};
