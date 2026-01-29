import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  AlertTriangle, 
  RefreshCw, 
  User, 
  Settings, 
  ChevronDown, 
  ChevronUp,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { 
  ParsedQBError, 
  getErrorTypeLabel, 
  getErrorTypeVariant,
  parseQuickBooksError,
  ErrorContext,
} from "@/lib/quickbooksErrorParser";
import { useSyncSingleVendor } from "@/integrations/supabase/hooks/useQuickBooks";
import { toast } from "sonner";

interface VendorBillSyncErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  errorMessage: string;
  vendorId?: string;
  vendorName?: string;
  billId?: string;
  billNumber?: string;
  onRetrySync?: () => Promise<void>;
}

export function VendorBillSyncErrorDialog({
  open,
  onOpenChange,
  errorMessage,
  vendorId,
  vendorName,
  billId,
  billNumber,
  onRetrySync,
}: VendorBillSyncErrorDialogProps) {
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);
  const [isResyncingVendor, setIsResyncingVendor] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const syncVendor = useSyncSingleVendor();

  const context: ErrorContext = {
    vendorName,
    vendorId,
    billNumber,
  };

  const parsedError: ParsedQBError = parseQuickBooksError(errorMessage, context);
  const badgeVariant = getErrorTypeVariant(parsedError.type);

  const handleResyncVendor = async () => {
    if (!vendorId) {
      toast.error("Vendor ID not available");
      return;
    }

    setIsResyncingVendor(true);
    try {
      await syncVendor.mutateAsync(vendorId);
      toast.success(`Vendor "${vendorName || 'Unknown'}" re-synced successfully`);
      
      // Optionally auto-retry the bill sync
      if (onRetrySync) {
        toast.info("Retrying bill sync...");
        await handleRetrySync();
      }
    } catch (error) {
      toast.error(`Failed to re-sync vendor: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsResyncingVendor(false);
    }
  };

  const handleRetrySync = async () => {
    if (!onRetrySync) return;
    
    setIsRetrying(true);
    try {
      await onRetrySync();
      toast.success("Bill synced to QuickBooks successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleViewVendor = () => {
    if (vendorId) {
      onOpenChange(false);
      navigate(`/vendors/${vendorId}`);
    }
  };

  const handleGoToSettings = () => {
    onOpenChange(false);
    navigate("/settings/quickbooks");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            QuickBooks Sync Failed
          </DialogTitle>
          <DialogDescription className="sr-only">
            QuickBooks synchronization error details and recovery options
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Error Type Badge */}
          <Badge 
            variant={badgeVariant === 'destructive' ? 'destructive' : badgeVariant === 'warning' ? 'secondary' : 'outline'}
            className="text-sm"
          >
            {getErrorTypeLabel(parsedError.type)}
          </Badge>

          {/* Error Description */}
          <div className="space-y-2">
            <p className="text-sm text-foreground">{parsedError.description}</p>
            
            {billNumber && (
              <p className="text-xs text-muted-foreground">
                Bill: <span className="font-medium">{billNumber}</span>
              </p>
            )}
          </div>

          {/* Technical Details (Collapsible) */}
          {parsedError.technicalDetails && (
            <Collapsible open={showDetails} onOpenChange={setShowDetails}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between p-2">
                  <span className="text-xs text-muted-foreground">Technical Details</span>
                  {showDetails ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="rounded-md bg-muted p-3 mt-2">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words font-mono">
                    {parsedError.technicalDetails}
                  </pre>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Suggested Actions */}
          {parsedError.actionable && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs text-muted-foreground font-medium">Suggested Actions:</p>
              <div className="flex flex-wrap gap-2">
                {/* Re-sync Vendor button */}
                {(parsedError.suggestedAction === 'resync_vendor' && vendorId) && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleResyncVendor}
                    disabled={isResyncingVendor}
                  >
                    {isResyncingVendor ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Re-sync Vendor
                  </Button>
                )}

                {/* View Vendor Profile */}
                {vendorId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleViewVendor}
                  >
                    <User className="h-4 w-4 mr-2" />
                    View Vendor
                  </Button>
                )}

                {/* Go to Settings (for auth errors) */}
                {parsedError.suggestedAction === 'reconnect' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleGoToSettings}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    QuickBooks Settings
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {onRetrySync && parsedError.suggestedAction !== 'reconnect' && (
            <Button 
              onClick={handleRetrySync}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Retry Sync
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
