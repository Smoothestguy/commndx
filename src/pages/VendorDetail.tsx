import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SendVendorOnboardingDialog } from "@/components/vendors/SendVendorOnboardingDialog";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import { useExpenseCategories } from "@/integrations/supabase/hooks/useExpenseCategories";
import { usePurchaseOrders } from "@/integrations/supabase/hooks/usePurchaseOrders";
import { useVendorBills } from "@/integrations/supabase/hooks/useVendorBills";
import { VendorDocumentUpload } from "@/components/vendors/VendorDocumentUpload";
import { VendorPersonnelSection } from "@/components/vendors/VendorPersonnelSection";
import { VendorEditDialog } from "@/components/vendors/VendorEditDialog";
import { InviteVendorDialog } from "@/components/vendors/InviteVendorDialog";
import { usePersonnelByVendor } from "@/integrations/supabase/hooks/usePersonnel";
import { useVendorDocuments } from "@/integrations/supabase/hooks/useVendorDocuments";
import { 
  useVendorInvitationCheck, 
  useSendVendorPortalInvitation, 
  useRevokeVendorPortalAccess 
} from "@/integrations/supabase/hooks/useVendorPortal";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  ArrowLeft, Building2, Mail, Phone, FileText, AlertCircle, Users, 
  MapPin, DollarSign, Receipt, CreditCard, ShoppingCart, ClipboardList,
  LayoutDashboard, Loader2, ExternalLink, UserCheck, UserPlus, UserMinus, Clock, Edit, Send
} from "lucide-react";
import { format } from "date-fns";

const PAYMENT_TERMS_LABELS: Record<string, string> = {
  due_on_receipt: "Due on Receipt",
  net_15: "Net 15",
  net_30: "Net 30",
  net_45: "Net 45",
  net_60: "Net 60",
};

export default function VendorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isOnboardingDialogOpen, setIsOnboardingDialogOpen] = useState(false);
  const { data: vendors, isLoading } = useVendors();
  const { data: expenseCategories } = useExpenseCategories("vendor");
  const { data: purchaseOrders } = usePurchaseOrders();
  const { data: vendorBills } = useVendorBills({ vendor_id: id });
  const { data: vendorPersonnel } = usePersonnelByVendor(id);
  const { data: vendorDocuments } = useVendorDocuments(id || "");

  const { data: pendingInvitation, isLoading: invitationLoading } = useVendorInvitationCheck(id);
  const sendInvitation = useSendVendorPortalInvitation();
  const revokeAccess = useRevokeVendorPortalAccess();
  
  const vendor = vendors?.find((v) => v.id === id);
  const expenseCategory = expenseCategories?.find((c) => c.id === vendor?.default_expense_category_id);
  
  // Filter purchase orders for this vendor
  const vendorPurchaseOrders = purchaseOrders?.filter(po => po.vendor_id === id) || [];
  
  // Calculate summary stats
  const personnelCount = vendorPersonnel?.length || 0;
  const poCount = vendorPurchaseOrders.length;
  const poTotal = vendorPurchaseOrders.reduce((sum, po) => sum + (po.total || 0), 0);
  const billsCount = vendorBills?.length || 0;
  const billsTotal = vendorBills?.reduce((sum, bill) => sum + (bill.total || 0), 0) || 0;
  const billsPaid = vendorBills?.reduce((sum, bill) => sum + (bill.paid_amount || 0), 0) || 0;
  const documentsCount = vendorDocuments?.length || 0;

  if (isLoading) {
    return (
      <PageLayout title="Vendor Details">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  if (!vendor) {
    return (
      <PageLayout title="Vendor Not Found">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">Vendor not found</p>
            <Button onClick={() => navigate("/vendors")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Vendors
            </Button>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  const isInsuranceExpired = vendor.insurance_expiry && new Date(vendor.insurance_expiry) < new Date();

  // Format address
  const addressParts = [vendor.address, vendor.city, vendor.state, vendor.zip].filter(Boolean);
  const formattedAddress = addressParts.length > 0 
    ? `${vendor.address || ""}${vendor.address && (vendor.city || vendor.state || vendor.zip) ? ", " : ""}${vendor.city || ""}${vendor.city && vendor.state ? ", " : " "}${vendor.state || ""} ${vendor.zip || ""}`.trim()
    : null;

  return (
    <PageLayout
      title={vendor.name}
      description="Vendor details and documents"
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/vendors")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Vendors
          </Button>
          <Button onClick={() => setIsEditDialogOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Vendor
          </Button>
          {vendor.onboarding_status !== "completed" && (
            <Button variant="outline" onClick={() => setIsOnboardingDialogOpen(true)}>
              <Send className="mr-2 h-4 w-4" />
              {vendor.onboarding_status === "invited" ? "Resend Onboarding" : "Send Onboarding"}
            </Button>
          )}
        </div>
        {/* Basic Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Vendor Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Company</p>
              <p className="font-medium">{vendor.company || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Specialty</p>
              <p className="font-medium">{vendor.specialty || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </p>
              <p className="font-medium">{vendor.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone
              </p>
              <p className="font-medium">{vendor.phone || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">License Number</p>
              <p className="font-medium">{vendor.license_number || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                Insurance Expiry
                {isInsuranceExpired && <AlertCircle className="h-4 w-4 text-destructive" />}
              </p>
              <p className={`font-medium ${isInsuranceExpired ? "text-destructive" : ""}`}>
                {vendor.insurance_expiry ? format(new Date(vendor.insurance_expiry), "MMM d, yyyy") : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">W-9 on File</p>
              <p className="font-medium">{vendor.w9_on_file ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                vendor.status === "active"
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
              }`}>
                {vendor.status}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Address Card */}
        {formattedAddress && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-5 w-5" />
                Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{formattedAddress}</p>
            </CardContent>
          </Card>
        )}

        {/* Financial Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-5 w-5" />
              Financial Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Tax ID</p>
              <p className="font-medium font-mono">
                {vendor.tax_id
                  ? vendor.tax_id.slice(0, -4).replace(/./g, "•") + vendor.tax_id.slice(-4)
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">1099 Tracking</p>
              <Badge variant={vendor.track_1099 ? "secondary" : "outline"}>
                {vendor.track_1099 ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Billing Rate
              </p>
              <p className="font-medium">{vendor.billing_rate ? `$${vendor.billing_rate.toFixed(2)}/hr` : "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payment Terms
              </p>
              <p className="font-medium">{vendor.payment_terms ? (PAYMENT_TERMS_LABELS[vendor.payment_terms] || vendor.payment_terms) : "N/A"}</p>
            </div>
            {vendor.account_number && (
              <div>
                <p className="text-sm text-muted-foreground">Account Number</p>
                <p className="font-medium font-mono">{vendor.account_number}</p>
              </div>
            )}
            {expenseCategory && (
              <div>
                <p className="text-sm text-muted-foreground">Default Expense Category</p>
                <p className="font-medium">{expenseCategory.name}</p>
              </div>
            )}
            {vendor.opening_balance != null && vendor.opening_balance > 0 && (
              <div>
                <p className="text-sm text-muted-foreground">Opening Balance</p>
                <p className="font-medium">${vendor.opening_balance.toFixed(2)}</p>
              </div>
            )}
            {/* Banking Information */}
            <div>
              <p className="text-sm text-muted-foreground">Bank Name</p>
              <p className="font-medium">{vendor.bank_name || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Bank Account Type</p>
              <p className="font-medium capitalize">{vendor.bank_account_type || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Routing Number</p>
              <p className="font-medium font-mono">
                {vendor.bank_routing_number
                  ? "•••••" + vendor.bank_routing_number.slice(-4)
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Account Number</p>
              <p className="font-medium font-mono">
                {vendor.bank_account_number
                  ? "•••••" + vendor.bank_account_number.slice(-4)
                  : "N/A"}
              </p>
            </div>
            {/* Signatures */}
            <div>
              <p className="text-sm text-muted-foreground">W-9 Signature</p>
              <p className="font-medium">
                {vendor.w9_signed_at
                  ? `Signed ${format(new Date(vendor.w9_signed_at), "MMM d, yyyy")}`
                  : "Not signed"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vendor Agreement</p>
              <p className="font-medium">
                {vendor.vendor_agreement_signed_at
                  ? `Signed ${format(new Date(vendor.vendor_agreement_signed_at), "MMM d, yyyy")}`
                  : "Not signed"}
              </p>
            </div>
            {/* Work Authorization */}
            {vendor.citizenship_status && (
              <div>
                <p className="text-sm text-muted-foreground">Citizenship Status</p>
                <p className="font-medium capitalize">
                  {vendor.citizenship_status === "us_citizen" ? "U.S. Citizen" : "Non-U.S. Citizen"}
                </p>
              </div>
            )}
            {vendor.immigration_status && (
              <div>
                <p className="text-sm text-muted-foreground">Immigration Status</p>
                <p className="font-medium capitalize">{vendor.immigration_status.replace(/_/g, " ")}</p>
              </div>
            )}
            {vendor.itin && (
              <div>
                <p className="text-sm text-muted-foreground">ITIN</p>
                <p className="font-medium font-mono">
                  {"•••••" + vendor.itin.slice(-4)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes Card */}
        {vendor.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{vendor.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Vendor Portal Access Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ExternalLink className="h-5 w-5" />
              Vendor Portal Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invitationLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Checking portal status...</span>
              </div>
            ) : vendor.user_id ? (
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-green-600" />
                  <span>Portal access is <strong className="text-green-600">active</strong></span>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <UserMinus className="mr-2 h-4 w-4" />
                      Revoke Access
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Revoke Portal Access?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove {vendor.name}'s access to the vendor portal. They will no longer be able to view purchase orders or submit bills. This action can be undone by sending a new invitation.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => revokeAccess.mutate(vendor.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Revoke Access
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : pendingInvitation ? (
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2 text-amber-600">
                    <Clock className="h-5 w-5" />
                    <span className="font-medium">Invitation pending</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Expires: {format(new Date(pendingInvitation.expires_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => sendInvitation.mutate({ 
                    vendorId: vendor.id, 
                    email: vendor.email, 
                    vendorName: vendor.name 
                  })}
                  disabled={sendInvitation.isPending}
                >
                  {sendInvitation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Resend Invitation
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <UserPlus className="h-5 w-5" />
                  <span>No portal access</span>
                </div>
                <Button onClick={() => setIsInviteDialogOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Grant Portal Access
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              All
            </TabsTrigger>
            <TabsTrigger value="personnel">
              <Users className="mr-2 h-4 w-4" />
              Personnel
            </TabsTrigger>
            <TabsTrigger value="purchase-orders">
              <ShoppingCart className="mr-2 h-4 w-4" />
              Purchase Orders
            </TabsTrigger>
            <TabsTrigger value="bills">
              <ClipboardList className="mr-2 h-4 w-4" />
              Bills
            </TabsTrigger>
            <TabsTrigger value="documents">
              <FileText className="mr-2 h-4 w-4" />
              Documents
            </TabsTrigger>
          </TabsList>
          
          {/* All Overview Tab */}
          <TabsContent value="all" className="mt-6 space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-[hsl(var(--stat-mint))]">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <Users className="h-8 w-8 text-emerald-600" />
                    <div>
                      <p className="text-2xl font-bold">{personnelCount}</p>
                      <p className="text-sm text-muted-foreground">Personnel</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-[hsl(var(--stat-sky))]">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="h-8 w-8 text-sky-600" />
                    <div>
                      <p className="text-2xl font-bold">{poCount}</p>
                      <p className="text-sm text-muted-foreground">POs (${poTotal.toLocaleString()})</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-[hsl(var(--stat-rose))]">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-8 w-8 text-rose-600" />
                    <div>
                      <p className="text-2xl font-bold">{billsCount}</p>
                      <p className="text-sm text-muted-foreground">Bills (${billsTotal.toLocaleString()})</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-[hsl(var(--stat-lavender))]">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-violet-600" />
                    <div>
                      <p className="text-2xl font-bold">{documentsCount}</p>
                      <p className="text-sm text-muted-foreground">Documents</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Personnel Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  Personnel ({personnelCount})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <VendorPersonnelSection vendorId={vendor.id} vendorName={vendor.name} />
              </CardContent>
            </Card>

            {/* Purchase Orders Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShoppingCart className="h-5 w-5" />
                  Purchase Orders ({poCount})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {vendorPurchaseOrders.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No purchase orders</p>
                ) : (
                  <div className="space-y-3">
                    {vendorPurchaseOrders.slice(0, 5).map((po) => (
                      <div 
                        key={po.id} 
                        className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => navigate(`/purchase-orders/${po.id}`)}
                      >
                        <div>
                          <p className="font-medium">{po.number}</p>
                          <p className="text-sm text-muted-foreground">{po.project_name}</p>
                        </div>
                        <div className="text-right">
                          <StatusBadge status={po.status} />
                          <p className="text-sm font-medium mt-1">${po.total.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                    {vendorPurchaseOrders.length > 5 && (
                      <p className="text-sm text-muted-foreground text-center">
                        +{vendorPurchaseOrders.length - 5} more purchase orders
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bills Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ClipboardList className="h-5 w-5" />
                  Bills ({billsCount}) - Paid: ${billsPaid.toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!vendorBills || vendorBills.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No bills</p>
                ) : (
                  <div className="space-y-3">
                    {vendorBills.slice(0, 5).map((bill) => (
                      <div 
                        key={bill.id} 
                        className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => navigate(`/vendor-bills/${bill.id}`)}
                      >
                        <div>
                          <p className="font-medium">{bill.number}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(bill.bill_date), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant={bill.status === 'paid' ? 'default' : bill.status === 'open' ? 'secondary' : 'outline'}>
                            {bill.status.replace('_', ' ')}
                          </Badge>
                          <p className="text-sm font-medium mt-1">${bill.total.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                    {vendorBills.length > 5 && (
                      <p className="text-sm text-muted-foreground text-center">
                        +{vendorBills.length - 5} more bills
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Documents Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5" />
                  Documents ({documentsCount})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <VendorDocumentUpload vendorId={vendor.id} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="personnel" className="mt-6">
            <VendorPersonnelSection vendorId={vendor.id} vendorName={vendor.name} />
          </TabsContent>
          <TabsContent value="purchase-orders" className="mt-6">
            {vendorPurchaseOrders.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No purchase orders for this vendor</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {vendorPurchaseOrders.map((po) => (
                  <Card 
                    key={po.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/purchase-orders/${po.id}`)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="font-semibold">{po.number}</p>
                          <p className="text-sm text-muted-foreground">{po.project_name}</p>
                        </div>
                        <div className="text-right space-y-1">
                          <StatusBadge status={po.status} />
                          <p className="text-sm font-medium">${po.total.toFixed(2)}</p>
                          {po.due_date && (
                            <p className="text-xs text-muted-foreground">
                              Due: {format(new Date(po.due_date), "MMM d, yyyy")}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="bills" className="mt-6">
            {!vendorBills || vendorBills.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No bills for this vendor</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {vendorBills.map((bill) => (
                  <Card 
                    key={bill.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/vendor-bills/${bill.id}`)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="font-semibold">{bill.number}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(bill.bill_date), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          <Badge variant={bill.status === 'paid' ? 'default' : bill.status === 'open' ? 'secondary' : 'outline'}>
                            {bill.status.replace('_', ' ')}
                          </Badge>
                          <p className="text-sm font-medium">${bill.total.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">
                            Paid: ${bill.paid_amount.toFixed(2)} | Remaining: ${bill.remaining_amount.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="documents" className="mt-6">
            <VendorDocumentUpload vendorId={vendor.id} />
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <VendorEditDialog
          vendor={vendor}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
        />

        {/* Invite to Portal Dialog */}
        <InviteVendorDialog
          open={isInviteDialogOpen}
          onOpenChange={setIsInviteDialogOpen}
          vendorId={vendor.id}
          vendorEmail={vendor.email}
          vendorName={vendor.name}
        />

        {/* Send Onboarding Dialog */}
        <SendVendorOnboardingDialog
          open={isOnboardingDialogOpen}
          onOpenChange={setIsOnboardingDialogOpen}
          vendorId={vendor.id}
          vendorName={vendor.name}
          vendorEmail={vendor.email}
        />
      </div>
    </PageLayout>
  );
}
