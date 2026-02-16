import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronDown, ChevronUp, Link2, X, Shield, Upload } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { VendorDocumentUpload } from "@/components/vendors/VendorDocumentUpload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateVendor, Vendor, VendorType } from "@/integrations/supabase/hooks/useVendors";
import { useExpenseCategories } from "@/integrations/supabase/hooks/useExpenseCategories";
import { useProfiles } from "@/integrations/supabase/hooks/useProfile";

const PAYMENT_TERMS_OPTIONS = [
  { value: "due_on_receipt", label: "Due on Receipt" },
  { value: "net_15", label: "Net 15" },
  { value: "net_30", label: "Net 30" },
  { value: "net_45", label: "Net 45" },
  { value: "net_60", label: "Net 60" },
];

interface VendorFormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  specialty: string;
  status: "active" | "inactive";
  vendor_type: VendorType;
  insurance_expiry: string;
  license_number: string;
  w9_on_file: boolean;
  address: string;
  city: string;
  state: string;
  zip: string;
  tax_id: string;
  track_1099: boolean;
  billing_rate: string;
  payment_terms: string;
  account_number: string;
  default_expense_category_id: string;
  opening_balance: string;
  notes: string;
  user_id: string;
  citizenship_status: string;
  immigration_status: string;
  itin: string;
}

interface VendorEditDialogProps {
  vendor: Vendor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VendorEditDialog({ vendor, open, onOpenChange }: VendorEditDialogProps) {
  const updateVendor = useUpdateVendor();
  const { data: expenseCategories } = useExpenseCategories("vendor");
  const { data: profiles } = useProfiles();
  const [additionalInfoOpen, setAdditionalInfoOpen] = useState(false);

  const [formData, setFormData] = useState<VendorFormData>({
    name: "",
    email: "",
    phone: "",
    company: "",
    specialty: "",
    status: "active",
    vendor_type: "supplier",
    insurance_expiry: "",
    license_number: "",
    w9_on_file: false,
    address: "",
    city: "",
    state: "",
    zip: "",
    tax_id: "",
    track_1099: false,
    billing_rate: "",
    payment_terms: "",
    account_number: "",
    default_expense_category_id: "",
    opening_balance: "",
    notes: "",
    user_id: "",
    citizenship_status: "",
    immigration_status: "",
    itin: "",
  });

  // Populate form when dialog opens
  useEffect(() => {
    if (open && vendor) {
      setFormData({
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone || "",
        company: vendor.company || "",
        specialty: vendor.specialty || "",
        status: vendor.status,
        vendor_type: vendor.vendor_type,
        insurance_expiry: vendor.insurance_expiry || "",
        license_number: vendor.license_number || "",
        w9_on_file: vendor.w9_on_file,
        address: vendor.address || "",
        city: vendor.city || "",
        state: vendor.state || "",
        zip: vendor.zip || "",
        tax_id: vendor.tax_id || "",
        track_1099: vendor.track_1099 || false,
        billing_rate: vendor.billing_rate?.toString() || "",
        payment_terms: vendor.payment_terms || "",
        account_number: vendor.account_number || "",
        default_expense_category_id: vendor.default_expense_category_id || "",
        opening_balance: vendor.opening_balance?.toString() || "",
        notes: vendor.notes || "",
        user_id: vendor.user_id || "",
        citizenship_status: vendor.citizenship_status || "",
        immigration_status: vendor.immigration_status || "",
        itin: vendor.itin || "",
      });
      const hasAdditionalInfo = vendor.tax_id || vendor.track_1099 || vendor.billing_rate ||
        vendor.payment_terms || vendor.account_number || vendor.default_expense_category_id ||
        vendor.opening_balance || vendor.notes || vendor.user_id;
      setAdditionalInfoOpen(!!hasAdditionalInfo);
    }
  }, [open, vendor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const vendorData = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone || null,
      company: formData.company || null,
      specialty: formData.specialty || null,
      status: formData.status,
      vendor_type: formData.vendor_type,
      insurance_expiry: formData.insurance_expiry || null,
      license_number: formData.license_number || null,
      w9_on_file: formData.w9_on_file,
      address: formData.address || null,
      city: formData.city || null,
      state: formData.state || null,
      zip: formData.zip || null,
      tax_id: formData.tax_id || null,
      track_1099: formData.track_1099,
      billing_rate: formData.billing_rate ? parseFloat(formData.billing_rate) : null,
      payment_terms: formData.payment_terms || null,
      account_number: formData.account_number || null,
      default_expense_category_id: formData.default_expense_category_id || null,
      opening_balance: formData.opening_balance ? parseFloat(formData.opening_balance) : null,
      notes: formData.notes || null,
      user_id: formData.user_id || null,
      citizenship_status: formData.citizenship_status || null,
      immigration_status: formData.immigration_status || null,
      itin: formData.itin || null,
    };

    await updateVendor.mutateAsync({
      id: vendor.id,
      ...vendorData,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Vendor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Information */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Vendor Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="specialty">Specialty</Label>
              <Input
                id="specialty"
                value={formData.specialty}
                onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: "active" | "inactive") =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor_type">Vendor Type</Label>
              <Select
                value={formData.vendor_type}
                onValueChange={(value: VendorType) =>
                  setFormData({ ...formData, vendor_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contractor">Contractor</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="license_number">License Number</Label>
              <Input
                id="license_number"
                value={formData.license_number}
                onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="insurance_expiry">Insurance Expiry</Label>
              <Input
                id="insurance_expiry"
                type="date"
                value={formData.insurance_expiry}
                onChange={(e) => setFormData({ ...formData, insurance_expiry: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <Checkbox
                id="w9_on_file"
                checked={formData.w9_on_file}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, w9_on_file: checked as boolean })
                }
              />
              <Label htmlFor="w9_on_file" className="cursor-pointer">W-9 on File</Label>
            </div>
          </div>

          {/* Address Section */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-medium text-muted-foreground">Address</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="123 Main St"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="CA"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip">ZIP</Label>
                  <Input
                    id="zip"
                    value={formData.zip}
                    onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                    placeholder="90210"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Additional Information - Collapsible */}
          <Collapsible open={additionalInfoOpen} onOpenChange={setAdditionalInfoOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" type="button" className="w-full justify-between">
                Additional Information
                {additionalInfoOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tax_id">Tax ID</Label>
                  <Input
                    id="tax_id"
                    value={formData.tax_id}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  />
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <Checkbox
                    id="track_1099"
                    checked={formData.track_1099}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, track_1099: checked as boolean })
                    }
                  />
                  <Label htmlFor="track_1099" className="cursor-pointer">Track 1099</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billing_rate">Billing Rate ($/hr)</Label>
                  <Input
                    id="billing_rate"
                    type="number"
                    step="0.01"
                    value={formData.billing_rate}
                    onChange={(e) => setFormData({ ...formData, billing_rate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_terms">Payment Terms</Label>
                  <Select
                    value={formData.payment_terms}
                    onValueChange={(value) => setFormData({ ...formData, payment_terms: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select terms" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TERMS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account_number">Account Number</Label>
                  <Input
                    id="account_number"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default_expense_category_id">Default Expense Category</Label>
                  <Select
                    value={formData.default_expense_category_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, default_expense_category_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="opening_balance">Opening Balance ($)</Label>
                  <Input
                    id="opening_balance"
                    type="number"
                    step="0.01"
                    value={formData.opening_balance}
                    onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Work Authorization Section */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Work Authorization
                </h4>
                <div className="space-y-3">
                  <Label>Citizenship Status</Label>
                  <RadioGroup
                    value={formData.citizenship_status}
                    onValueChange={(value) => setFormData({ ...formData, citizenship_status: value, immigration_status: value === "us_citizen" ? "" : formData.immigration_status })}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="us_citizen" id="edit_us_citizen" />
                      <Label htmlFor="edit_us_citizen" className="cursor-pointer">U.S. Citizen</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="non_us_citizen" id="edit_non_us_citizen" />
                      <Label htmlFor="edit_non_us_citizen" className="cursor-pointer">Non-U.S. Citizen</Label>
                    </div>
                  </RadioGroup>
                </div>

                {formData.citizenship_status === "non_us_citizen" && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="immigration_status">Immigration Status</Label>
                      <Select
                        value={formData.immigration_status}
                        onValueChange={(value) => setFormData({ ...formData, immigration_status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="visa">Visa</SelectItem>
                          <SelectItem value="work_permit">Work Permit</SelectItem>
                          <SelectItem value="green_card">Green Card</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.immigration_status === "other" && (
                      <div className="space-y-2">
                        <Label htmlFor="itin">ITIN</Label>
                        <Input
                          id="itin"
                          value={formData.itin}
                          onChange={(e) => setFormData({ ...formData, itin: e.target.value })}
                          placeholder="9XX-XX-XXXX"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Document Upload for Work Authorization */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload Work Authorization Documents
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Upload visa, EAD card, green card, or other work authorization documents below.
                  </p>
                  <VendorDocumentUpload vendorId={vendor.id} />
                </div>
              </div>

              {/* Portal Access Section */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Portal Access
                </h4>
                <div className="space-y-2">
                  <Label htmlFor="user_id">Linked User Account</Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.user_id}
                      onValueChange={(value) => setFormData({ ...formData, user_id: value })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a user account to link" />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles?.map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.full_name || profile.email || profile.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.user_id && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setFormData({ ...formData, user_id: "" })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Link a user account to allow portal access for this {formData.vendor_type === "contractor" ? "subcontractor" : "vendor"}.
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateVendor.isPending}>
              {updateVendor.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
