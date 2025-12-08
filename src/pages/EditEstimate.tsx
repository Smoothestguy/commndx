import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Loader2, AlertTriangle, ArrowLeft, Edit, Eye } from "lucide-react";
import { EstimatePreviewDialog } from "@/components/estimates/EstimatePreviewDialog";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { useProjectsByCustomer } from "@/integrations/supabase/hooks/useProjects";
import { useProducts } from "@/integrations/supabase/hooks/useProducts";
import { useEstimate, useUpdateEstimate } from "@/integrations/supabase/hooks/useEstimates";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
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
  id?: string;
  product_id?: string;
  description: string;
  quantity: string;
  unit_price: string;
  margin: string;
  pricing_type: 'markup' | 'margin';
  is_taxable: boolean;
  total: number;
}

const EditEstimate = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: estimate, isLoading: estimateLoading } = useEstimate(id || "");
  const { data: customers, isLoading: customersLoading } = useCustomers();
  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: companySettings } = useCompanySettings();
  const updateEstimate = useUpdateEstimate();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [taxRate, setTaxRate] = useState<string>("8.25");
  const [validUntil, setValidUntil] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [status, setStatus] = useState<"draft" | "pending" | "sent" | "approved">("draft");
  const [defaultPricingType, setDefaultPricingType] = useState<'markup' | 'margin'>('margin');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: projects } = useProjectsByCustomer(selectedCustomerId);

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
      
      // Convert line items to form format
      const formLineItems = estimate.line_items.map((item) => ({
        id: item.id,
        product_id: item.product_id,
        description: item.description,
        quantity: item.quantity.toString(),
        unit_price: item.unit_price.toString(),
        margin: item.markup.toString(),
        pricing_type: (item.pricing_type || 'margin') as 'markup' | 'margin',
        is_taxable: item.is_taxable ?? true,
        total: item.total,
      }));
      
      setLineItems(formLineItems.length > 0 ? formLineItems : [
        { description: "", quantity: "1", unit_price: "", margin: "0", pricing_type: "margin", is_taxable: true, total: 0 },
      ]);
      
      setIsInitialized(true);
    }
  }, [estimate, isInitialized]);

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
      const margin = product.markup.toString();
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
        navigate(`/estimates/${id}`);
      },
    });
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
        <Button variant="outline" onClick={() => navigate(`/estimates/${id}`)}>
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
                          <span className="font-medium">{product.name}</span>
                          {product.description && (
                            <span className="text-muted-foreground"> - {product.description}</span>
                          )}
                          <span className="text-muted-foreground ml-1">(${product.price.toFixed(2)})</span>
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
                        <SelectItem value="margin">Margin %</SelectItem>
                        <SelectItem value="markup">Markup %</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{item.pricing_type === 'margin' ? 'Margin' : 'Markup'} (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.margin}
                      onChange={(e) => updateLineItem(index, "margin", e.target.value)}
                      className="bg-secondary border-border"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-border">
                  <span className="text-sm text-muted-foreground mr-2">Line Total:</span>
                  <span className="font-semibold">${item.total.toFixed(2)}</span>
                </div>
              </div>
            ))}
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
            onClick={() => navigate(`/estimates/${id}`)}
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
      </form>
    </PageLayout>
  );
};

export default EditEstimate;
