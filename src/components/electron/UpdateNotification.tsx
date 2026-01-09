import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UpdateInfo {
  status: string;
  data?: {
    version?: string;
    percent?: number;
    message?: string;
  };
}

export function UpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only run in Electron
    if (!window.electronAPI?.isElectron) return;

    // Listen for update status changes
    window.electronAPI.onUpdateStatus((info) => {
      setUpdateInfo(info);
      // Show notification for relevant statuses
      if (['available', 'downloading', 'downloaded', 'error'].includes(info.status)) {
        setIsVisible(true);
      }
    });
  }, []);

  const handleDownload = async () => {
    if (window.electronAPI?.downloadUpdate) {
      await window.electronAPI.downloadUpdate();
    }
  };

  const handleInstall = () => {
    if (window.electronAPI?.installUpdate) {
      window.electronAPI.installUpdate();
    }
  };

  const handleCheckForUpdates = async () => {
    if (window.electronAPI?.checkForUpdates) {
      setUpdateInfo({ status: 'checking' });
      setIsVisible(true);
      await window.electronAPI.checkForUpdates();
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!window.electronAPI?.isElectron || !isVisible || !updateInfo) {
    return null;
  }

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-50 w-80 bg-card border rounded-lg shadow-lg p-4",
      "animate-in slide-in-from-bottom-4 duration-300"
    )}>
      {/* Checking for updates */}
      {updateInfo.status === 'checking' && (
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm">Checking for updates...</span>
        </div>
      )}

      {/* Update available */}
      {updateInfo.status === 'available' && (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Download className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Update Available</p>
              <p className="text-sm text-muted-foreground">
                Version {updateInfo.data?.version} is ready to download
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleDownload} className="flex-1">
              Download
            </Button>
            <Button size="sm" variant="outline" onClick={handleDismiss}>
              Later
            </Button>
          </div>
        </div>
      )}

      {/* Downloading */}
      {updateInfo.status === 'downloading' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm">Downloading update...</span>
          </div>
          <Progress value={updateInfo.data?.percent || 0} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">
            {(updateInfo.data?.percent || 0).toFixed(1)}%
          </p>
        </div>
      )}

      {/* Downloaded - ready to install */}
      {updateInfo.status === 'downloaded' && (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium">Update Ready</p>
              <p className="text-sm text-muted-foreground">
                Version {updateInfo.data?.version} will be installed on restart
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleInstall} className="flex-1">
              Restart Now
            </Button>
            <Button size="sm" variant="outline" onClick={handleDismiss}>
              Later
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {updateInfo.status === 'error' && (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium">Update Error</p>
              <p className="text-sm text-muted-foreground">
                {updateInfo.data?.message || 'Failed to check for updates'}
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={handleDismiss} className="w-full">
            Dismiss
          </Button>
        </div>
      )}

      {/* No update available */}
      {updateInfo.status === 'not-available' && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="text-sm">You're up to date!</span>
          </div>
          <Button size="sm" variant="ghost" onClick={handleDismiss}>
            OK
          </Button>
        </div>
      )}
    </div>
  );
}

// Export a button component to manually check for updates
export function CheckForUpdatesButton() {
  const handleCheck = async () => {
    if (window.electronAPI?.checkForUpdates) {
      await window.electronAPI.checkForUpdates();
    }
  };

  if (!window.electronAPI?.isElectron) {
    return null;
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCheck}>
      <RefreshCw className="h-4 w-4 mr-2" />
      Check for Updates
    </Button>
  );
}

