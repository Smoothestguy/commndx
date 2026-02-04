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
            Please check your internet connection and try again. If the problem persists, 
            copy the diagnostics and contact support.
          </p>
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
