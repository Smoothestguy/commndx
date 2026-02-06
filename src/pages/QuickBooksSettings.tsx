import { useState, useEffect, useRef } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  useImportInvoicesFromQB,
  useImportAccountsFromQB,
} from "@/integrations/supabase/hooks/useQuickBooks";
import { useImportEstimatesFromQuickBooks } from "@/integrations/supabase/hooks/useEstimates";
import {
  useAutoSyncPersonnelToQB,
  useToggleAutoSyncPersonnelToQB,
} from "@/integrations/supabase/hooks/useIntegrationSettings";
import { ProductConflictDialog } from "@/components/quickbooks/ProductConflictDialog";
import { JournalEntriesViewer } from "@/components/quickbooks/JournalEntriesViewer";
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
  UserCheck,
  Receipt,
  FolderOpen,
  FileText,
  Square,
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

  // Abort controllers for cancellable syncs
  const vendorImportAbortRef = useRef<AbortController | null>(null);
  const vendorExportAbortRef = useRef<AbortController | null>(null);

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

  const importVendors = useImportVendorsFromQB(
    (processed, total) => {
      setVendorImportProgress({ processed, total });
    }
  );
  const exportVendors = useExportVendorsToQB(
    (processed, total) => {
      setVendorExportProgress({ processed, total });
    }
  );

  // Invoice import
  const importInvoices = useImportInvoicesFromQB();

  // Estimate import from QuickBooks
  const importEstimates = useImportEstimatesFromQuickBooks();

  // Expense categories/accounts import
  const importAccounts = useImportAccountsFromQB();

  // Auto-sync personnel setting
  const { isEnabled: autoSyncEnabled, isLoading: autoSyncLoading } = useAutoSyncPersonnelToQB();
  const toggleAutoSync = useToggleAutoSyncPersonnelToQB();

  const handleAutoSyncToggle = (checked: boolean) => {
    toggleAutoSync.mutate(checked, {
      onSuccess: () => {
        toast.success(checked ? "Auto-sync enabled" : "Auto-sync disabled");
      },
    });
  };

  const handleImportVendors = () => {
    vendorImportAbortRef.current = new AbortController();
    setVendorImportProgress({ processed: 0, total: 0 });
    importVendors.mutate(vendorImportAbortRef.current.signal, {
      onSettled: () => {
        setVendorImportProgress(null);
        vendorImportAbortRef.current = null;
      },
    });
  };

  const handleCancelVendorImport = () => {
    if (vendorImportAbortRef.current) {
      vendorImportAbortRef.current.abort();
      toast.info("Cancelling vendor import...");
    }
  };

  const handleExportVendors = () => {
    vendorExportAbortRef.current = new AbortController();
    setVendorExportProgress({ processed: 0, total: 0 });
    exportVendors.mutate(vendorExportAbortRef.current.signal, {
      onSettled: () => {
        setVendorExportProgress(null);
        vendorExportAbortRef.current = null;
      },
    });
  };

  const handleCancelVendorExport = () => {
    if (vendorExportAbortRef.current) {
      vendorExportAbortRef.current.abort();
      toast.info("Cancelling vendor export...");
    }
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
    exportVendors.isPending ||
    importInvoices.isPending ||
    importEstimates.isPending ||
    importAccounts.isPending;

  return (
    <PageLayout
      title="QuickBooks Integration"
      description="Connect and sync data with QuickBooks Online"
    >
      <div className="space-y-4 sm:space-y-6">
        {/* Connection Status Card */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              {isConnected ? (
                <Cloud className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 shrink-0" />
              ) : (
                <CloudOff className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
              )}
              Connection Status
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {isConnected
                ? `Connected to ${config?.company_name || "QuickBooks"}`
                : "Not connected to QuickBooks"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={isConnected ? "default" : "secondary"}>
                    {isConnected ? "Connected" : "Disconnected"}
                  </Badge>
                  {config?.last_sync_at && (
                    <span className="text-xs sm:text-sm text-muted-foreground">
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
                  size="default"
                  className="w-full sm:w-auto min-h-[44px]"
                  onClick={handleDisconnect}
                  disabled={disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending
                    ? "Disconnecting..."
                    : "Disconnect"}
                </Button>
              ) : (
                <Button
                  size="default"
                  className="w-full sm:w-auto min-h-[44px]"
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
            <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-3">
              {/* Products Sync */}
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Package className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                    Products Sync
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Sync products between CommandX and QuickBooks
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-3 sm:space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 min-w-0 min-h-[44px]"
                      onClick={() => importProducts.mutate()}
                      disabled={isSyncing}
                    >
                      <Download className="h-4 w-4 mr-2 shrink-0" />
                      Import
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 min-w-0 min-h-[44px]"
                      onClick={() => exportProducts.mutate()}
                      disabled={isSyncing}
                    >
                      <Upload className="h-4 w-4 mr-2 shrink-0" />
                      Export
                    </Button>
                  </div>
                  {importProducts.isPending && (
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
                      Importing products...
                    </div>
                  )}
                  {exportProducts.isPending && (
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
                      Exporting products...
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Customers Sync */}
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                    Customers Sync
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Sync customers between CommandX and QuickBooks
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-3 sm:space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 min-w-0 min-h-[44px]"
                      onClick={() => importCustomers.mutate()}
                      disabled={isSyncing}
                    >
                      <Download className="h-4 w-4 mr-2 shrink-0" />
                      Import
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 min-w-0 min-h-[44px]"
                      onClick={() => exportCustomers.mutate()}
                      disabled={isSyncing}
                    >
                      <Upload className="h-4 w-4 mr-2 shrink-0" />
                      Export
                    </Button>
                  </div>
                  {importCustomers.isPending && (
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
                      Importing customers...
                    </div>
                  )}
                  {exportCustomers.isPending && (
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
                      Exporting customers...
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Vendors Sync */}
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Truck className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                    Vendors Sync
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Sync vendors between CommandX and QuickBooks
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-3 sm:space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 min-w-0 min-h-[44px]"
                      onClick={handleImportVendors}
                      disabled={isSyncing}
                    >
                      <Download className="h-4 w-4 mr-2 shrink-0" />
                      Import
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 min-w-0 min-h-[44px]"
                      onClick={handleExportVendors}
                      disabled={isSyncing}
                    >
                      <Upload className="h-4 w-4 mr-2 shrink-0" />
                      Export
                    </Button>
                  </div>
                  {importVendors.isPending && vendorImportProgress && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                          <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
                          Importing vendors... ({vendorImportProgress.processed}/
                          {vendorImportProgress.total})
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={handleCancelVendorImport}
                        >
                          <Square className="h-3 w-3 mr-1 fill-current" />
                          Cancel
                        </Button>
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
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                          <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
                          Exporting vendors... ({vendorExportProgress.processed}/
                          {vendorExportProgress.total})
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={handleCancelVendorExport}
                        >
                          <Square className="h-3 w-3 mr-1 fill-current" />
                          Cancel
                        </Button>
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

              {/* Personnel Auto-Sync */}
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                    Personnel Auto-Sync
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Automatically sync personnel to QuickBooks as vendors when they complete onboarding
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="auto-sync-personnel" className="text-sm flex-1">
                      Auto-sync on completion
                    </Label>
                    <Switch
                      id="auto-sync-personnel"
                      checked={autoSyncEnabled}
                      onCheckedChange={handleAutoSyncToggle}
                      disabled={autoSyncLoading || toggleAutoSync.isPending}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    When enabled, newly onboarded personnel will be automatically created as vendors in QuickBooks.
                  </p>
                </CardContent>
              </Card>

              {/* Invoices Import */}
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Receipt className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                    Invoices Import
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Import existing invoices from QuickBooks into CommandX
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-3 sm:space-y-4">
                  <Button
                    variant="outline"
                    className="w-full min-h-[44px]"
                    onClick={() => importInvoices.mutate()}
                    disabled={isSyncing}
                  >
                    {importInvoices.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin shrink-0" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2 shrink-0" />
                        Import Invoices from QB
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Imports all invoices from QuickBooks. Customers must be synced first for invoices to be imported.
                  </p>
                </CardContent>
              </Card>

              {/* Estimates Import */}
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                    Estimates Import
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Import existing estimates from QuickBooks into CommandX
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-3 sm:space-y-4">
                  <Button
                    variant="outline"
                    className="w-full min-h-[44px]"
                    onClick={() => importEstimates.mutate()}
                    disabled={isSyncing}
                  >
                    {importEstimates.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin shrink-0" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2 shrink-0" />
                        Import Estimates from QB
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Imports estimates from QuickBooks with consistent numbering. Customers must be synced first.
                  </p>
                </CardContent>
              </Card>

              {/* Expense Categories Sync */}
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <FolderOpen className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                    Expense Categories
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Import expense account categories from QuickBooks Chart of Accounts
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-3 sm:space-y-4">
                  <Button
                    variant="outline"
                    className="w-full min-h-[44px]"
                    onClick={() => importAccounts.mutate()}
                    disabled={isSyncing}
                  >
                    {importAccounts.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin shrink-0" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2 shrink-0" />
                        Import Categories from QB
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Imports expense accounts (Expense, Cost of Goods Sold, Other Expense) as expense categories for reimbursements and vendor bills.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Journal Entries Viewer */}
            <JournalEntriesViewer />

            {/* Conflicts */}
            {conflicts && conflicts.length > 0 && (
              <Card className="border-orange-500/50">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-orange-600">
                    <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                    Price Conflicts ({conflicts.length})
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    These products have different prices in CommandX and
                    QuickBooks. Click to resolve.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                  <div className="space-y-2">
                    {conflicts.map((conflict: any) => (
                      <div
                        key={conflict.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer min-h-[44px] active:bg-muted/70"
                        onClick={() => setSelectedConflict(conflict)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm sm:text-base truncate">
                            {conflict.products?.name}
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            <span className="inline-block">
                              CommandX: $
                              {conflict.conflict_data?.commandx_price?.toFixed(
                                2
                              )}
                            </span>
                            <span className="mx-1">|</span>
                            <span className="inline-block">
                              QB: $
                              {conflict.conflict_data?.quickbooks_price?.toFixed(
                                2
                              )}
                            </span>
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
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                  Recent Sync Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                <ScrollArea className="h-[250px] sm:h-[300px]">
                  {syncLogs && syncLogs.length > 0 ? (
                    <div className="space-y-2">
                      {syncLogs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-start sm:items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border"
                        >
                          {log.status === "success" ? (
                            <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5 sm:mt-0" />
                          ) : log.status === "partial" ? (
                            <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5 sm:mt-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5 sm:mt-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-medium truncate">
                              {log.action.charAt(0).toUpperCase() +
                                log.action.slice(1)}{" "}
                              {log.entity_type}
                            </p>
                            <p className="text-xs text-muted-foreground flex flex-wrap gap-x-1">
                              <span>
                                {format(
                                  new Date(log.created_at),
                                  "MMM d, h:mm a"
                                )}
                              </span>
                              {log.details &&
                                typeof log.details === "object" &&
                                "imported" in log.details && (
                                  <span>
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
                    <div className="text-center py-6 sm:py-8 text-sm text-muted-foreground">
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
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">
              Setup Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm sm:text-base">
                Before connecting:
              </h4>
              <ol className="list-decimal list-inside text-xs sm:text-sm text-muted-foreground space-y-1.5 sm:space-y-1">
                <li>
                  Create a QuickBooks Developer account at developer.intuit.com
                </li>
                <li>Create an app and get your Client ID and Client Secret</li>
                <li className="leading-relaxed">
                  Add your redirect URI:{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs break-all">
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
              <h4 className="font-medium text-sm sm:text-base">
                Sync behavior:
              </h4>
              <ul className="list-disc list-inside text-xs sm:text-sm text-muted-foreground space-y-1.5 sm:space-y-1">
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
