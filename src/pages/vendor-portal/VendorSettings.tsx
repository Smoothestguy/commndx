import { VendorPortalLayout } from "@/components/vendor-portal/VendorPortalLayout";
import { useCurrentVendor } from "@/integrations/supabase/hooks/useVendorPortal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Building2 } from "lucide-react";
import { DeleteAccountSection } from "@/components/settings/DeleteAccountSection";

export default function VendorSettings() {
  const { data: vendor, isLoading } = useCurrentVendor();

  if (isLoading) {
    return (
      <VendorPortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </VendorPortalLayout>
    );
  }

  return (
    <VendorPortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account settings</p>
        </div>

        {/* Profile Info Card */}
        {vendor && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Your vendor details (contact admin to make changes)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {vendor.company && (
                  <div>
                    <p className="text-sm text-muted-foreground">Company</p>
                    <p className="font-medium">{vendor.company}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{vendor.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{vendor.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{vendor.phone || "Not set"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Danger Zone - Account Deletion */}
        <DeleteAccountSection />
      </div>
    </VendorPortalLayout>
  );
}
