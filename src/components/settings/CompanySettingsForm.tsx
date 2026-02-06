import { useState } from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCompanySettings, useUpdateCompanySettings, useUploadLogo } from "@/integrations/supabase/hooks/useCompanySettings";
import { Building2, Loader2, ChevronDown, Lock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export const CompanySettingsForm = () => {
  const { data: settings, isLoading } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();
  const uploadLogo = useUploadLogo();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<any>({
    values: settings || {},
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: any) => {
    try {
      let logoUrl = settings?.logo_url;

      if (logoFile) {
        logoUrl = await uploadLogo.mutateAsync(logoFile);
      }

      await updateSettings.mutateAsync({
        ...data,
        logo_url: logoUrl,
        default_tax_rate: parseFloat(data.default_tax_rate) || 0,
        overtime_threshold: parseFloat(data.overtime_threshold) || 8,
        weekly_overtime_threshold: parseFloat(data.weekly_overtime_threshold) || 40,
        overtime_multiplier: parseFloat(data.overtime_multiplier) || 1.5,
      });
    } catch (error) {
      console.error("Error updating company settings:", error);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Company Settings
                </CardTitle>
                <CardDescription>
                  Manage your company information and defaults
                </CardDescription>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Company Logo</Label>
              <div className="flex items-center gap-4">
                {(logoPreview || settings?.logo_url) && (
                  <img
                    src={logoPreview || settings?.logo_url || ''}
                    alt="Company logo"
                    className="h-20 w-20 object-contain rounded border border-border"
                  />
                )}
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name *</Label>
                <Input
                  id="company_name"
                  {...register("company_name", { required: true })}
                />
                {errors.company_name && (
                  <p className="text-sm text-destructive">Company name is required</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="legal_name">Legal Name</Label>
                <Input id="legal_name" {...register("legal_name")} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" {...register("address")} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" {...register("city")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" {...register("state")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zip">ZIP Code</Label>
                <Input id="zip" {...register("zip")} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" {...register("phone")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register("email")} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input id="website" type="url" {...register("website")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax_id">Tax ID</Label>
                <Input id="tax_id" {...register("tax_id")} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="default_tax_rate">Default Tax Rate (%)</Label>
                <Input
                  id="default_tax_rate"
                  type="number"
                  step="0.01"
                  {...register("default_tax_rate")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="overtime_multiplier">Overtime Multiplier</Label>
                <Input
                  id="overtime_multiplier"
                  type="number"
                  step="0.1"
                  {...register("overtime_multiplier")}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="overtime_threshold">Daily Overtime Threshold (hours)</Label>
                <Input
                  id="overtime_threshold"
                  type="number"
                  step="0.5"
                  {...register("overtime_threshold")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weekly_overtime_threshold">Weekly Overtime Threshold (hours)</Label>
                <Input
                  id="weekly_overtime_threshold"
                  type="number"
                  step="0.5"
                  {...register("weekly_overtime_threshold")}
                />
              </div>
            </div>

            {/* Locked Period Settings Section */}
            <div className="border-t pt-6 mt-6">
              <div className="flex items-center gap-2 mb-4">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-lg font-medium">Accounting Period Lock</h3>
              </div>
              
              <Alert className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  When enabled, transactions dated on or before the locked period date cannot be created, edited, or synced to QuickBooks. This protects reconciled accounting data.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="locked_period_enabled">Enable Locked Period</Label>
                    <p className="text-sm text-muted-foreground">
                      Block transactions before the cutoff date
                    </p>
                  </div>
                  <Switch
                    id="locked_period_enabled"
                    checked={settings?.locked_period_enabled || false}
                    onCheckedChange={(checked) => {
                      updateSettings.mutate({ locked_period_enabled: checked });
                    }}
                  />
                </div>

                {settings?.locked_period_enabled && (
                  <div className="space-y-2">
                    <Label htmlFor="locked_period_date">Lock Transactions Through</Label>
                    <Input
                      id="locked_period_date"
                      type="date"
                      value={settings?.locked_period_date || ""}
                      onChange={(e) => {
                        updateSettings.mutate({ locked_period_date: e.target.value || null });
                      }}
                      max={format(new Date(), "yyyy-MM-dd")}
                    />
                    <p className="text-sm text-muted-foreground">
                      All transactions dated on or before this date will be locked
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t pt-6 mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invoice_footer">Invoice Footer</Label>
                <Textarea
                  id="invoice_footer"
                  {...register("invoice_footer")}
                  placeholder="Thank you for your business!"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimate_footer">Estimate Footer</Label>
                <Textarea
                  id="estimate_footer"
                  {...register("estimate_footer")}
                  placeholder="We look forward to working with you!"
                />
              </div>
            </div>
          </div>

              <Button
                type="submit"
                disabled={updateSettings.isPending || uploadLogo.isPending}
              >
                {(updateSettings.isPending || uploadLogo.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </form>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
