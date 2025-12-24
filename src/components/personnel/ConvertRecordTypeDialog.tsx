import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Loader2, Users, ArrowRight } from "lucide-react";
import { toast } from "sonner";

type ConversionType = "create_vendor" | "create_customer";

interface ConvertRecordTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personnel: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    linked_vendor_id: string | null;
  };
}

const conversionOptions = [
  {
    value: "create_vendor" as ConversionType,
    label: "Create Linked Vendor",
    description: "Creates a new vendor record linked to this personnel for billing and POs",
    icon: Building2,
  },
  {
    value: "create_customer" as ConversionType,
    label: "Create as Customer",
    description: "Creates a customer record with this personnel's information",
    icon: Users,
  },
];

export const ConvertRecordTypeDialog = ({
  open,
  onOpenChange,
  personnel,
}: ConvertRecordTypeDialogProps) => {
  const [selectedType, setSelectedType] = useState<ConversionType>("create_vendor");
  const queryClient = useQueryClient();

  const createVendorMutation = useMutation({
    mutationFn: async () => {
      // Create vendor from personnel data
      const { data: vendor, error: vendorError } = await supabase
        .from("vendors")
        .insert([{
          name: `${personnel.first_name} ${personnel.last_name}`,
          email: personnel.email,
          phone: personnel.phone,
          address: personnel.address,
          city: personnel.city,
          state: personnel.state,
          zip: personnel.zip,
        }])
        .select()
        .single();

      if (vendorError) throw vendorError;

      // Link personnel to vendor
      const { error: updateError } = await supabase
        .from("personnel")
        .update({ linked_vendor_id: vendor.id })
        .eq("id", personnel.id);

      if (updateError) throw updateError;

      return vendor;
    },
    onSuccess: (vendor) => {
      toast.success("Vendor record created and linked", {
        description: `${vendor.name} is now linked as a vendor.`,
      });
      queryClient.invalidateQueries({ queryKey: ["personnel", personnel.id] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to create vendor", {
        description: error.message,
      });
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: async () => {
      const { data: customer, error } = await supabase
        .from("customers")
        .insert([{
          name: `${personnel.first_name} ${personnel.last_name}`,
          email: personnel.email,
          phone: personnel.phone,
          address: personnel.address,
        }])
        .select()
        .single();

      if (error) throw error;
      return customer;
    },
    onSuccess: (customer) => {
      toast.success("Customer record created", {
        description: `${customer.name} has been added as a customer.`,
      });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to create customer", {
        description: error.message,
      });
    },
  });

  const handleConfirm = () => {
    if (selectedType === "create_vendor") {
      createVendorMutation.mutate();
    } else if (selectedType === "create_customer") {
      createCustomerMutation.mutate();
    }
  };

  const isLoading = createVendorMutation.isPending || createCustomerMutation.isPending;

  // Filter options based on existing links
  const availableOptions = conversionOptions.filter((option) => {
    if (option.value === "create_vendor" && personnel.linked_vendor_id) {
      return false; // Already has linked vendor
    }
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Additional Record</DialogTitle>
          <DialogDescription>
            Create an additional record type for{" "}
            <strong>
              {personnel.first_name} {personnel.last_name}
            </strong>
            . This will copy their information to the new record.
          </DialogDescription>
        </DialogHeader>

        {availableOptions.length === 0 ? (
          <div className="py-4 text-center text-muted-foreground">
            <p>All available record types have already been created for this personnel.</p>
          </div>
        ) : (
          <RadioGroup
            value={selectedType}
            onValueChange={(value) => setSelectedType(value as ConversionType)}
            className="space-y-3"
          >
            {availableOptions.map((option) => (
              <div
                key={option.value}
                className={`flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                  selectedType === option.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => setSelectedType(option.value)}
              >
                <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <option.icon className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor={option.value} className="font-medium cursor-pointer">
                      {option.label}
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          {availableOptions.length > 0 && (
            <Button onClick={handleConfirm} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              Create Record
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
