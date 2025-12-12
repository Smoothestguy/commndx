import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useQuickBooksConfig,
  useQuickBooksConnect,
  useQuickBooksDisconnect,
  useGetQuickBooksAuthUrl,
  useImportProductsFromQB,
  useExportProductsToQB,
  useImportCustomersFromQB,
  useExportCustomersToQB,
  useImportVendorsFromQB,
  useExportVendorsToQB,
  useQuickBooksSyncLogs,
  useQuickBooksConflicts,
} from "@/integrations/supabase/hooks/useQuickBooks";
import { ProductConflictDialog } from "@/components/quickbooks/ProductConflictDialog";
import { QuickBooksSyncBadge } from "@/components/quickbooks/QuickBooksSyncBadge";
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Download,
  Upload,
  Users,
  Package,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Truck,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const QuickBooksSettings = () => {
  const [searchParams] = useSearchParams();
  const [selectedConflict, setSelectedConflict] = useState<any>(null);
  const [vendorImportProgress, setVendorImportProgress] = useState<{
    processed: number;
    total: number;
  } | null>(null);
  const [vendorExportProgress, setVendorExportProgress] = useState<{
    processed: number;
    total: number;
  } | null>(null);

  const { data: config, isLoading: configLoading } = useQuickBooksConfig();
  const { data: syncLogs } = useQuickBooksSyncLogs(20);
  const { data: conflicts } = useQuickBooksConflicts();

  const connectMutation = useQuickBooksConnect();
  const disconnectMutation = useQuickBooksDisconnect();
  const getAuthUrl = useGetQuickBooksAuthUrl();

  const importProducts = useImportProductsFromQB();
  const exportProducts = useExportProductsToQB();
  const importCustomers = useImportCustomersFromQB();
  const exportCustomers = useExportCustomersToQB();

  const importVendors = useImportVendorsFromQB((processed, total) => {
    setVendorImportProgress({ processed, total });
  });
  const exportVendors = useExportVendorsToQB((processed, total) => {
    setVendorExportProgress({ processed, total });
  });

  const handleImportVendors = () => {
    setVendorImportProgress({ processed: 0, total: 0 });
    importVendors.mutate(undefined, {
      onSettled: () => setVendorImportProgress(null),
    });
  };

  const handleExportVendors = () => {
    setVendorExportProgress({ processed: 0, total: 0 });
    exportVendors.mutate(undefined, {
      onSettled: () => setVendorExportProgress(null),
    });
  };

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get("code");
    const realmId = searchParams.get("realmId");

    if (code && realmId) {
      const redirectUri = `${window.location.origin}/settings/quickbooks`;

      // Debug logging for OAuth callback
      console.log("=== OAuth Callback Debug ===");
      console.log("window.location.origin:", window.location.origin);
      console.log("window.location.href:", window.location.href);
      console.log("Code received:", code?.substring(0, 10) + "...");
      console.log("Realm ID:", realmId);
      console.log("Redirect URI for exchange:", redirectUri);
      console.log("============================");

      connectMutation.mutate(
        { code, realmId, redirectUri },
        {
          onSuccess: () => {
            // Clear URL params
            window.history.replaceState({}, "", "/settings/quickbooks");
          },
        }
      );
    }
  }, [searchParams]);

  const handleConnect = async () => {
    try {
      const redirectUri = `${window.location.origin}/settings/quickbooks`;

      // Debug logging before OAuth initiation
      console.log("=== QuickBooks Connect Debug ===");
      console.log("window.location.origin:", window.location.origin);
      console.log("window.location.href:", window.location.href);
      console.log("Redirect URI being sent:", redirectUri);
      console.log("================================");

      const result = await getAuthUrl.mutateAsync(redirectUri);

      console.log("Auth URL received:", result.authUrl);

      // Open QuickBooks auth in new window or redirect
      window.location.href = result.authUrl;
    } catch (error) {
      console.error("QuickBooks connect error:", error);
      toast.error("Failed to initiate connection");
    }
  };

  const handleDisconnect = () => {
    if (confirm("Are you sure you want to disconnect from QuickBooks?")) {
      disconnectMutation.mutate();
    }
  };

  const isConnected = config?.is_connected;
  const isSyncing =
    importProducts.isPending ||
    exportProducts.isPending ||
    importCustomers.isPending ||
    exportCustomers.isPending ||
    importVendors.isPending ||
    exportVendors.isPending;

  return (
    <PageLayout
      title="QuickBooks Integration"
      description="Connect and sync data with QuickBooks Online"
    >
      <div className="space-y-6">
        {/* Connection Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isConnected ? (
                <Cloud className="h-5 w-5 text-green-500" />
              ) : (
                <CloudOff className="h-5 w-5 text-muted-foreground" />
              )}
              Connection Status
            </CardTitle>
            <CardDescription>
              {isConnected
                ? `Connected to ${config?.company_name || "QuickBooks"}`
                : "Not connected to QuickBooks"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={isConnected ? "default" : "secondary"}>
                    {isConnected ? "Connected" : "Disconnected"}
                  </Badge>
                  {config?.last_sync_at && (
                    <span className="text-sm text-muted-foreground">
                      Last sync:{" "}
                      {format(
                        new Date(config.last_sync_at),
                        "MMM d, yyyy h:mm a"
                      )}
                    </span>
                  )}
                </div>
              </div>
              {isConnected ? (
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending
                    ? "Disconnecting..."
                    : "Disconnect"}
                </Button>
              ) : (
                <Button
                  onClick={handleConnect}
                  disabled={getAuthUrl.isPending || connectMutation.isPending}
                >
                  {getAuthUrl.isPending || connectMutation.isPending
                    ? "Connecting..."
                    : "Connect to QuickBooks"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {isConnected && (
          <>
            {/* Sync Actions */}
            <div className="grid gap-4 md:grid-cols-3">
              {/* Products Sync */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Package className="h-5 w-5" />
                    Products Sync
                  </CardTitle>
                  <CardDescription>
                    Sync products between CommandX and QuickBooks
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 min-w-0"
                      onClick={() => importProducts.mutate()}
                      disabled={isSyncing}
                    >
                      <Download className="h-4 w-4 mr-2 shrink-0" />
                      Import
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 min-w-0"
                      onClick={() => exportProducts.mutate()}
                      disabled={isSyncing}
                    >
                      <Upload className="h-4 w-4 mr-2 shrink-0" />
                      Export
                    </Button>
                  </div>
                  {importProducts.isPending && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Importing products...
                    </div>
                  )}
                  {exportProducts.isPending && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Exporting products...
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Customers Sync */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5" />
                    Customers Sync
                  </CardTitle>
                  <CardDescription>
                    Sync customers between CommandX and QuickBooks
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 min-w-0"
                      onClick={() => importCustomers.mutate()}
                      disabled={isSyncing}
                    >
                      <Download className="h-4 w-4 mr-2 shrink-0" />
                      Import
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 min-w-0"
                      onClick={() => exportCustomers.mutate()}
                      disabled={isSyncing}
                    >
                      <Upload className="h-4 w-4 mr-2 shrink-0" />
                      Export
                    </Button>
                  </div>
                  {importCustomers.isPending && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Importing customers...
                    </div>
                  )}
                  {exportCustomers.isPending && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Exporting customers...
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Vendors Sync */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Truck className="h-5 w-5" />
                    Vendors Sync
                  </CardTitle>
                  <CardDescription>
                    Sync vendors between CommandX and QuickBooks
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 min-w-0"
                      onClick={handleImportVendors}
                      disabled={isSyncing}
                    >
                      <Download className="h-4 w-4 mr-2 shrink-0" />
                      Import
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 min-w-0"
                      onClick={handleExportVendors}
                      disabled={isSyncing}
                    >
                      <Upload className="h-4 w-4 mr-2 shrink-0" />
                      Export
                    </Button>
                  </div>
                  {importVendors.isPending && vendorImportProgress && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Importing vendors... ({vendorImportProgress.processed}/
                        {vendorImportProgress.total})
                      </div>
                      {vendorImportProgress.total > 0 && (
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${
                                (vendorImportProgress.processed /
                                  vendorImportProgress.total) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  {exportVendors.isPending && vendorExportProgress && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Exporting vendors... ({vendorExportProgress.processed}/
                        {vendorExportProgress.total})
                      </div>
                      {vendorExportProgress.total > 0 && (
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${
                                (vendorExportProgress.processed /
                                  vendorExportProgress.total) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Conflicts */}
            {conflicts && conflicts.length > 0 && (
              <Card className="border-orange-500/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg text-orange-600">
                    <AlertTriangle className="h-5 w-5" />
                    Price Conflicts ({conflicts.length})
                  </CardTitle>
                  <CardDescription>
                    These products have different prices in CommandX and
                    QuickBooks. Click to resolve.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {conflicts.map((conflict: any) => (
                      <div
                        key={conflict.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSelectedConflict(conflict)}
                      >
                        <div>
                          <p className="font-medium">
                            {conflict.products?.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            CommandX: $
                            {conflict.conflict_data?.commandx_price?.toFixed(2)}{" "}
                            | QuickBooks: $
                            {conflict.conflict_data?.quickbooks_price?.toFixed(
                              2
                            )}
                          </p>
                        </div>
                        <QuickBooksSyncBadge status="conflict" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sync Log */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5" />
                  Recent Sync Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {syncLogs && syncLogs.length > 0 ? (
                    <div className="space-y-2">
                      {syncLogs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center gap-3 p-2 rounded-lg border"
                        >
                          {log.status === "success" ? (
                            <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                          ) : log.status === "partial" ? (
                            <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {log.action.charAt(0).toUpperCase() +
                                log.action.slice(1)}{" "}
                              {log.entity_type}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(
                                new Date(log.created_at),
                                "MMM d, h:mm a"
                              )}
                              {log.details &&
                                typeof log.details === "object" &&
                                "imported" in log.details && (
                                  <span className="ml-2">
                                    • {(log.details as any).imported} imported,{" "}
                                    {(log.details as any).updated} updated
                                  </span>
                                )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No sync activity yet
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </>
        )}

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Setup Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Before connecting:</h4>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                <li>
                  Create a QuickBooks Developer account at developer.intuit.com
                </li>
                <li>Create an app and get your Client ID and Client Secret</li>
                <li>
                  Add your redirect URI:{" "}
                  <code className="bg-muted px-1 rounded">
                    {window.location.origin}/settings/quickbooks
                  </code>
                </li>
                <li>
                  Ensure your app has the "com.intuit.quickbooks.accounting"
                  scope
                </li>
              </ol>
            </div>
            <Separator />
            <div className="space-y-2">
              <h4 className="font-medium">Sync behavior:</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>
                  Products sync two-way, with conflict detection for price
                  differences
                </li>
                <li>Customers sync two-way between both systems</li>
                <li>Vendors sync two-way between both systems</li>
                <li>
                  Invoices created in CommandX are automatically synced to
                  QuickBooks
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <ProductConflictDialog
        open={!!selectedConflict}
        onOpenChange={(open) => !open && setSelectedConflict(null)}
        conflict={selectedConflict}
      />
    </PageLayout>
  );
};

export default QuickBooksSettings;
