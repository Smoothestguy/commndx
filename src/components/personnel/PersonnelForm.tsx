import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAddPersonnel, useUpdatePersonnel } from "@/integrations/supabase/hooks/usePersonnel";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import { PhotoUpload } from "./PhotoUpload";
import type { Database } from "@/integrations/supabase/types";

type Personnel = Database["public"]["Tables"]["personnel"]["Row"];

const personnelSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2).optional(),
  zip: z.string().optional(),
  date_of_birth: z.string().optional(),
  hourly_rate: z.number().min(0).optional(),
  pay_rate: z.number().min(0).optional(),
  bill_rate: z.number().min(0).optional(),
  status: z.enum(["active", "inactive", "do_not_hire"]),
  ssn_last_four: z.string().max(4).optional(),
  work_authorization_type: z.enum(["citizen", "permanent_resident", "work_visa", "ead", "other"]).optional(),
  work_auth_expiry: z.string().optional(),
  i9_completed_at: z.string().optional(),
  everify_status: z.enum(["pending", "verified", "rejected", "expired", "not_required"]),
  everify_case_number: z.string().optional(),
  notes: z.string().optional(),
  vendor_id: z.string().optional(),
  portal_required: z.boolean().optional(),
});

type PersonnelFormData = z.infer<typeof personnelSchema>;

interface PersonnelFormProps {
  personnel?: Personnel;
  onSuccess?: (newPersonnelId?: string) => void;
  onCancel?: () => void;
  defaultVendorId?: string;
  defaultTab?: string;
}

export const PersonnelForm = ({ personnel, onSuccess, onCancel, defaultVendorId, defaultTab }: PersonnelFormProps) => {
  const [photoUrl, setPhotoUrl] = useState(personnel?.photo_url || "");
  const [activeTab, setActiveTab] = useState(defaultTab || "personal");

  const addMutation = useAddPersonnel();
  const updateMutation = useUpdatePersonnel();
  const { data: vendors } = useVendors();

  // Auto-save photo for existing personnel
  const handlePhotoSaved = async (url: string) => {
    if (personnel?.id) {
      await updateMutation.mutateAsync({
        id: personnel.id,
        updates: { photo_url: url },
      });
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<PersonnelFormData>({
    resolver: zodResolver(personnelSchema),
    defaultValues: {
      first_name: personnel?.first_name || "",
      last_name: personnel?.last_name || "",
      email: personnel?.email || "",
      phone: personnel?.phone || "",
      address: personnel?.address || "",
      city: personnel?.city || "",
      state: personnel?.state || "",
      zip: personnel?.zip || "",
      date_of_birth: personnel?.date_of_birth || "",
      hourly_rate: personnel?.hourly_rate || 0,
      pay_rate: (personnel as any)?.pay_rate || personnel?.hourly_rate || 0,
      bill_rate: (personnel as any)?.bill_rate || 0,
      status: (personnel?.status as any) || "active",
      ssn_last_four: personnel?.ssn_last_four || "",
      work_authorization_type: (personnel?.work_authorization_type as any) || undefined,
      work_auth_expiry: personnel?.work_auth_expiry || "",
      i9_completed_at: personnel?.i9_completed_at || "",
      everify_status: (personnel?.everify_status as any) || "pending",
      everify_case_number: personnel?.everify_case_number || "",
      notes: personnel?.notes || "",
      vendor_id: (personnel as any)?.vendor_id || defaultVendorId || "",
      portal_required: (personnel as any)?.portal_required ?? true,
    },
  });

  const onSubmit = async (data: PersonnelFormData) => {
    // Sync hourly_rate with pay_rate so time tracking uses the correct rate
    const payRate = data.pay_rate || 0;
    
    const formData = {
      ...data,
      photo_url: photoUrl,
      personnel_number: personnel?.personnel_number || "",
      vendor_id: data.vendor_id || null,
      // Convert empty date strings to null for PostgreSQL
      date_of_birth: data.date_of_birth || null,
      work_auth_expiry: data.work_auth_expiry || null,
      i9_completed_at: data.i9_completed_at || null,
      // Ensure pay_rate and bill_rate are included
      pay_rate: payRate,
      bill_rate: data.bill_rate || 0,
      // Keep hourly_rate in sync with pay_rate for time tracking calculations
      hourly_rate: payRate,
    };

    if (personnel) {
      await updateMutation.mutateAsync({
        id: personnel.id,
        updates: formData,
      });
      onSuccess?.();
    } else {
      const result = await addMutation.mutateAsync(formData as any);
      onSuccess?.(result?.id);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="i9">I-9 & E-Verify</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Basic contact and demographic information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PhotoUpload
                currentPhotoUrl={photoUrl}
                onPhotoChange={setPhotoUrl}
                onPhotoSaved={personnel?.id ? handlePhotoSaved : undefined}
                personnelId={personnel?.id}
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input id="first_name" {...register("first_name")} />
                  {errors.first_name && (
                    <p className="text-sm text-destructive">{errors.first_name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input id="last_name" {...register("last_name")} />
                  {errors.last_name && (
                    <p className="text-sm text-destructive">{errors.last_name.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" {...register("email")} />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" {...register("phone")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input id="date_of_birth" type="date" {...register("date_of_birth")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" {...register("address")} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" {...register("city")} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" maxLength={2} {...register("state")} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="zip">ZIP Code</Label>
                <Input id="zip" {...register("zip")} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="i9" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>I-9 Compliance</CardTitle>
              <CardDescription>Work authorization and identification</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ssn_last_four">SSN (Last 4 Digits)</Label>
                <Input
                  id="ssn_last_four"
                  maxLength={4}
                  placeholder="****"
                  {...register("ssn_last_four")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="work_authorization_type">Work Authorization Type</Label>
                <Select
                  value={watch("work_authorization_type")}
                  onValueChange={(value) =>
                    setValue("work_authorization_type", value as any)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="citizen">U.S. Citizen</SelectItem>
                    <SelectItem value="permanent_resident">Permanent Resident</SelectItem>
                    <SelectItem value="work_visa">Work Visa</SelectItem>
                    <SelectItem value="ead">Employment Authorization Document</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Only show expiry for work types that require it */}
              {["work_visa", "ead", "other"].includes(watch("work_authorization_type") || "") && (
                <div className="space-y-2">
                  <Label htmlFor="work_auth_expiry">Authorization Expiry Date *</Label>
                  <Input id="work_auth_expiry" type="date" {...register("work_auth_expiry")} />
                  <p className="text-sm text-muted-foreground">
                    Required for this authorization type
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="i9_completed_at">I-9 Completion Date</Label>
                <Input id="i9_completed_at" type="date" {...register("i9_completed_at")} />
                <p className="text-sm text-muted-foreground">
                  Date when Form I-9 employment verification was completed
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>E-Verify</CardTitle>
              <CardDescription>E-Verify status and information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="everify_status">E-Verify Status</Label>
                <Select
                  value={watch("everify_status")}
                  onValueChange={(value) => setValue("everify_status", value as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="not_required">Not Required</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="everify_case_number">E-Verify Case Number</Label>
                <Input id="everify_case_number" {...register("everify_case_number")} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Employment Details</CardTitle>
              <CardDescription>Status and compensation information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={watch("status")}
                  onValueChange={(value) => setValue("status", value as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="do_not_hire">Do Not Hire</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="portal_required" className="text-base">Requires Portal Access</Label>
                  <p className="text-sm text-muted-foreground">
                    Disable for temporary or day workers who don't need to log into the portal
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="portal_required"
                  checked={watch("portal_required") ?? true}
                  onChange={(e) => setValue("portal_required", e.target.checked)}
                  className="h-5 w-5 rounded border-gray-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pay_rate">Pay Rate (Internal)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="pay_rate"
                      type="number"
                      step="0.01"
                      className="pl-7"
                      {...register("pay_rate", { valueAsNumber: true })}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Used for payroll & vendor bills
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bill_rate">Bill Rate (Customer)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="bill_rate"
                      type="number"
                      step="0.01"
                      className="pl-7"
                      {...register("bill_rate", { valueAsNumber: true })}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Used for customer invoices
                  </p>
                </div>
              </div>

              {/* Show warning if bill_rate <= pay_rate */}
              {watch("bill_rate") !== undefined && watch("pay_rate") !== undefined && 
               watch("bill_rate")! > 0 && watch("pay_rate")! > 0 && 
               watch("bill_rate")! <= watch("pay_rate")! && (
                <p className="text-sm text-yellow-600">
                  ⚠️ Bill rate should typically be higher than pay rate for margin
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="vendor_id">Assigned Vendor</Label>
                <Select
                  value={watch("vendor_id") || "__none__"}
                  onValueChange={(value) => setValue("vendor_id", value === "__none__" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No Vendor</SelectItem>
                    {vendors?.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" rows={4} {...register("notes")} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={addMutation.isPending || updateMutation.isPending}>
          {addMutation.isPending || updateMutation.isPending
            ? "Saving..."
            : personnel
            ? "Update Personnel"
            : "Add Personnel"}
        </Button>
      </div>
    </form>
  );
};
