import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
import { AlertTriangle, Building2, Loader2, Users, ArrowRight, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { useQuickBooksConfig, useSyncSingleVendor } from "@/integrations/supabase/hooks/useQuickBooks";

type ConversionType = "create_vendor" | "create_customer" | "switch_to_vendor" | "switch_to_customer";

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

const createOptions = [
  {
    value: "create_vendor" as ConversionType,
    label: "Create Linked Vendor",
    description: "Creates a new vendor record linked to this personnel for billing and POs",
    icon: Building2,
    isSwitch: false,
  },
  {
    value: "create_customer" as ConversionType,
    label: "Create Customer Record",
    description: "Creates a customer record with this personnel's information",
    icon: Users,
    isSwitch: false,
  },
];

const switchOptions = [
  {
    value: "switch_to_vendor" as ConversionType,
    label: "Switch to Vendor",
    description: "Deactivates personnel record and creates a vendor instead",
    icon: ArrowRightLeft,
    isSwitch: true,
  },
  {
    value: "switch_to_customer" as ConversionType,
    label: "Switch to Customer",
    description: "Deactivates personnel record and creates a customer instead",
    icon: ArrowRightLeft,
    isSwitch: true,
  },
];

export const ConvertRecordTypeDialog = ({
  open,
  onOpenChange,
  personnel,
}: ConvertRecordTypeDialogProps) => {
  const [selectedType, setSelectedType] = useState<ConversionType>("create_vendor");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  // QuickBooks hooks
  const { data: qbConfig } = useQuickBooksConfig();
  const syncVendorToQB = useSyncSingleVendor();

  const isSwitch = selectedType === "switch_to_vendor" || selectedType === "switch_to_customer";

  const createVendorMutation = useMutation({
    mutationFn: async () => {
      // Fetch full personnel record to get SSN for tax purposes
      const { data: fullPersonnel } = await supabase
        .from("personnel")
        .select("ssn_full")
        .eq("id", personnel.id)
        .single();

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
          // Tax fields for 1099 tracking
          tax_id: fullPersonnel?.ssn_full || null,
          track_1099: true,
          vendor_type: 'personnel',
        }])
        .select()
        .single();

      if (vendorError) throw vendorError;

      const { error: updateError } = await supabase
        .from("personnel")
        .update({ linked_vendor_id: vendor.id })
        .eq("id", personnel.id);

      if (updateError) throw updateError;

      return vendor;
    },
    onSuccess: async (vendor) => {
      // Sync to QuickBooks if connected
      if (qbConfig?.is_connected) {
        try {
          await syncVendorToQB.mutateAsync(vendor.id);
          toast.success("Vendor created and synced to QuickBooks", {
            description: `${vendor.name} is now linked as a vendor.`,
          });
        } catch (qbError) {
          console.error("QuickBooks sync failed:", qbError);
          toast.success("Vendor record created and linked", {
            description: "QuickBooks sync pending - can be retried from vendor page",
          });
        }
      } else {
        toast.success("Vendor record created and linked", {
          description: `${vendor.name} is now linked as a vendor.`,
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["personnel", personnel.id] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to create vendor", { description: error.message });
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
      toast.error("Failed to create customer", { description: error.message });
    },
  });

  const switchToVendorMutation = useMutation({
    mutationFn: async () => {
      // Fetch full personnel record to get SSN for tax purposes
      const { data: fullPersonnel } = await supabase
        .from("personnel")
        .select("ssn_full")
        .eq("id", personnel.id)
        .single();

      // Create vendor record with tax fields
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
          // Tax fields for 1099 tracking
          tax_id: fullPersonnel?.ssn_full || null,
          track_1099: true,
          vendor_type: 'personnel',
        }])
        .select()
        .single();

      if (vendorError) throw vendorError;

      // Deactivate personnel record
      const { error: updateError } = await supabase
        .from("personnel")
        .update({ 
          status: "inactive",
          notes: `Switched to vendor record on ${new Date().toLocaleDateString()}. Vendor ID: ${vendor.id}`
        })
        .eq("id", personnel.id);

      if (updateError) throw updateError;

      return vendor;
    },
    onSuccess: async (vendor) => {
      // Sync to QuickBooks if connected
      if (qbConfig?.is_connected) {
        try {
          await syncVendorToQB.mutateAsync(vendor.id);
          toast.success("Switched to Vendor and synced to QuickBooks", {
            description: `Personnel deactivated. New vendor record created.`,
          });
        } catch (qbError) {
          console.error("QuickBooks sync failed:", qbError);
          toast.success("Switched to Vendor", {
            description: "QuickBooks sync pending - can be retried from vendor page",
          });
        }
      } else {
        toast.success("Switched to Vendor", {
          description: `Personnel deactivated. New vendor record created.`,
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      onOpenChange(false);
      navigate(`/vendors/${vendor.id}`);
    },
    onError: (error) => {
      toast.error("Failed to switch to vendor", { description: error.message });
    },
  });

  const switchToCustomerMutation = useMutation({
    mutationFn: async () => {
      // Create customer record
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert([{
          name: `${personnel.first_name} ${personnel.last_name}`,
          email: personnel.email,
          phone: personnel.phone,
          address: personnel.address,
        }])
        .select()
        .single();

      if (customerError) throw customerError;

      // Deactivate personnel record
      const { error: updateError } = await supabase
        .from("personnel")
        .update({ 
          status: "inactive",
          notes: `Switched to customer record on ${new Date().toLocaleDateString()}. Customer ID: ${customer.id}`
        })
        .eq("id", personnel.id);

      if (updateError) throw updateError;

      return customer;
    },
    onSuccess: (customer) => {
      toast.success("Switched to Customer", {
        description: `Personnel deactivated. New customer record created.`,
      });
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onOpenChange(false);
      navigate(`/customers/${customer.id}`);
    },
    onError: (error) => {
      toast.error("Failed to switch to customer", { description: error.message });
    },
  });

  const handleConfirm = () => {
    switch (selectedType) {
      case "create_vendor":
        createVendorMutation.mutate();
        break;
      case "create_customer":
        createCustomerMutation.mutate();
        break;
      case "switch_to_vendor":
        switchToVendorMutation.mutate();
        break;
      case "switch_to_customer":
        switchToCustomerMutation.mutate();
        break;
    }
  };

  const isLoading = 
    createVendorMutation.isPending || 
    createCustomerMutation.isPending ||
    switchToVendorMutation.isPending ||
    switchToCustomerMutation.isPending;

  // Filter create options based on existing links
  const availableCreateOptions = createOptions.filter((option) => {
    if (option.value === "create_vendor" && personnel.linked_vendor_id) {
      return false;
    }
    return true;
  });

  const allOptions = [...availableCreateOptions, ...switchOptions];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Convert or Create Additional Record</DialogTitle>
          <DialogDescription>
            What would you like to do with{" "}
            <strong>{personnel.first_name} {personnel.last_name}</strong>?
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={selectedType}
          onValueChange={(value) => setSelectedType(value as ConversionType)}
          className="space-y-2"
        >
          {/* Create Options */}
          {availableCreateOptions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Create (Keep Personnel)
              </p>
              {availableCreateOptions.map((option) => (
                <OptionCard
                  key={option.value}
                  option={option}
                  isSelected={selectedType === option.value}
                  onSelect={() => setSelectedType(option.value)}
                />
              ))}
            </div>
          )}

          {/* Switch Options */}
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Switch (Replace Personnel)
            </p>
            {switchOptions.map((option) => (
              <OptionCard
                key={option.value}
                option={option}
                isSelected={selectedType === option.value}
                onSelect={() => setSelectedType(option.value)}
              />
            ))}
          </div>
        </RadioGroup>

        {/* Warning for switch actions */}
        {isSwitch && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-sm text-destructive">
              This will deactivate the personnel record and create a new{" "}
              {selectedType === "switch_to_vendor" ? "vendor" : "customer"} record. 
              The personnel will no longer appear in active personnel lists.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isLoading}
            variant={isSwitch ? "destructive" : "default"}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-2" />
            )}
            {isSwitch ? "Switch Record" : "Create Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface OptionCardProps {
  option: {
    value: ConversionType;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    isSwitch: boolean;
  };
  isSelected: boolean;
  onSelect: () => void;
}

const OptionCard = ({ option, isSelected, onSelect }: OptionCardProps) => (
  <div
    className={`flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
      isSelected
        ? option.isSwitch 
          ? "border-destructive bg-destructive/5" 
          : "border-primary bg-primary/5"
        : "border-border hover:border-primary/50"
    }`}
    onClick={onSelect}
  >
    <RadioGroupItem value={option.value} id={option.value} className="mt-0.5" />
    <div className="flex-1 space-y-0.5">
      <div className="flex items-center gap-2">
        <option.icon className={`h-4 w-4 ${option.isSwitch ? "text-destructive" : "text-muted-foreground"}`} />
        <Label htmlFor={option.value} className="font-medium cursor-pointer text-sm">
          {option.label}
        </Label>
        {option.isSwitch && (
          <span className="text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
            Destructive
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{option.description}</p>
    </div>
  </div>
);
