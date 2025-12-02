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
  status: z.enum(["active", "inactive", "do_not_hire"]),
  ssn_last_four: z.string().max(4).optional(),
  work_authorization_type: z.enum(["citizen", "permanent_resident", "work_visa", "ead", "other"]).optional(),
  work_auth_expiry: z.string().optional(),
  everify_status: z.enum(["pending", "verified", "rejected", "expired", "not_required"]),
  everify_case_number: z.string().optional(),
  notes: z.string().optional(),
});

type PersonnelFormData = z.infer<typeof personnelSchema>;

interface PersonnelFormProps {
  personnel?: Personnel;
  onSuccess?: (newPersonnelId?: string) => void;
  onCancel?: () => void;
}

export const PersonnelForm = ({ personnel, onSuccess, onCancel }: PersonnelFormProps) => {
  const [photoUrl, setPhotoUrl] = useState(personnel?.photo_url || "");
  const [activeTab, setActiveTab] = useState("personal");

  const addMutation = useAddPersonnel();
  const updateMutation = useUpdatePersonnel();

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
      status: (personnel?.status as any) || "active",
      ssn_last_four: personnel?.ssn_last_four || "",
      everify_status: (personnel?.everify_status as any) || "pending",
      everify_case_number: personnel?.everify_case_number || "",
      notes: personnel?.notes || "",
    },
  });

  const onSubmit = async (data: PersonnelFormData) => {
    const formData = {
      ...data,
      photo_url: photoUrl,
      personnel_number: personnel?.personnel_number || "",
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

              <div className="space-y-2">
                <Label htmlFor="work_auth_expiry">Authorization Expiry Date</Label>
                <Input id="work_auth_expiry" type="date" {...register("work_auth_expiry")} />
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

              <div className="space-y-2">
                <Label htmlFor="hourly_rate">Hourly Rate</Label>
                <Input
                  id="hourly_rate"
                  type="number"
                  step="0.01"
                  {...register("hourly_rate", { valueAsNumber: true })}
                />
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
