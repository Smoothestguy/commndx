import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { LineItemBuilder, LineItem } from "./LineItemBuilder";
import { Loader2 } from "lucide-react";
import type { FormRequestPrefilled } from "@/contexts/AIAssistantContext";

interface InvoiceFormInlineProps {
  prefilled?: FormRequestPrefilled;
  onSubmit: (data: {
    type: "create_invoice";
    customer_id: string;
    customer_name: string;
    line_items: Array<{ description: string; quantity: number; unit_price: number }>;
    notes?: string;
  }) => void;
  isSubmitting?: boolean;
}

export function InvoiceFormInline({ prefilled, onSubmit, isSubmitting }: InvoiceFormInlineProps) {
  const { data: customers = [], isLoading: customersLoading } = useCustomers();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(prefilled?.customer_id || "");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>(() => {
    if (prefilled?.line_items && prefilled.line_items.length > 0) {
      return prefilled.line_items.map((item) => ({
        id: crypto.randomUUID(),
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }));
    }
    return [
      {
        id: crypto.randomUUID(),
        description: "",
        quantity: 1,
        unit_price: 0,
      },
    ];
  });

  // Try to match prefilled customer name to an existing customer
  useEffect(() => {
    if (prefilled?.customer_name && !selectedCustomerId && customers.length > 0) {
      const match = customers.find(
        (c) => c.name.toLowerCase().includes(prefilled.customer_name!.toLowerCase())
      );
      if (match) {
        setSelectedCustomerId(match.id);
      }
    }
  }, [prefilled?.customer_name, customers, selectedCustomerId]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCustomerId || !selectedCustomer) return;
    
    const validItems = lineItems.filter(
      (item) => item.description && item.quantity > 0 && item.unit_price > 0
    );
    
    if (validItems.length === 0) return;

    onSubmit({
      type: "create_invoice",
      customer_id: selectedCustomerId,
      customer_name: selectedCustomer.name,
      line_items: validItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
      notes: notes || undefined,
    });
  };

  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  const isValid =
    selectedCustomerId &&
    lineItems.some(
      (item) => item.description && item.quantity > 0 && item.unit_price > 0
    );

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      {/* Customer Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Customer</label>
        <Select
          value={selectedCustomerId}
          onValueChange={setSelectedCustomerId}
          disabled={customersLoading}
        >
          <SelectTrigger className="h-11 text-sm">
            <SelectValue placeholder={customersLoading ? "Loading..." : "Select customer..."} />
          </SelectTrigger>
          <SelectContent>
            {customers.map((customer) => (
              <SelectItem key={customer.id} value={customer.id}>
                {customer.name}
                {customer.company && (
                  <span className="text-muted-foreground ml-2">({customer.company})</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Line Items */}
      <LineItemBuilder items={lineItems} onChange={setLineItems} />

      {/* Notes */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Notes (optional)</label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes..."
          className="min-h-[80px] text-sm resize-none"
        />
      </div>

      {/* Submit */}
      <Button
        type="submit"
        className="w-full h-12 text-base font-medium"
        disabled={!isValid || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Creating...
          </>
        ) : (
          <>Create Invoice — ${subtotal.toFixed(2)}</>
        )}
      </Button>
    </form>
  );
}
