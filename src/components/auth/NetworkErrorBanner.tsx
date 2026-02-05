import { useState } from "react";
import { AlertCircle, Copy, RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyDiagnostics } from "@/utils/authNetwork";

interface NetworkErrorBannerProps {
  onRetry: () => void;
  isRetrying?: boolean;
}

export function NetworkErrorBanner({ onRetry, isRetrying }: NetworkErrorBannerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyDiagnostics = async () => {
    const success = await copyDiagnostics();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 mt-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium text-destructive">
            Can't reach the sign-in service
          </p>
          <p className="text-xs text-muted-foreground">
            This may be caused by your browser settings or a network issue. Try these steps:
          </p>
          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1 pl-1">
            <li>Open an <strong>incognito/private window</strong> and try again</li>
            <li>Disable ad blockers or privacy extensions for this site</li>
            <li>Check your internet connection</li>
            <li>Try a different browser (Firefox, Edge)</li>
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={isRetrying}
              className="h-8"
            >
              {isRetrying ? (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Retry
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopyDiagnostics}
              className="h-8 text-muted-foreground"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copy diagnostics
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
