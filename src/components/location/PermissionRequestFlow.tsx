import { useState } from "react";
import { MapPin, Shield, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocationTracking } from "@/contexts/LocationTrackingContext";

interface PermissionRequestFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
}

export function PermissionRequestFlow({
  open,
  onOpenChange,
  onPermissionGranted,
  onPermissionDenied,
}: PermissionRequestFlowProps) {
  const { isNative, requestPermission, permissionStatus } = useLocationTracking();
  const [isRequesting, setIsRequesting] = useState(false);
  const [step, setStep] = useState<"explain" | "requesting" | "success" | "denied">("explain");

  const handleRequestPermission = async () => {
    setStep("requesting");
    setIsRequesting(true);

    try {
      const granted = await requestPermission();
      
      if (granted) {
        setStep("success");
        onPermissionGranted?.();
        // Auto-close after success
        setTimeout(() => {
          onOpenChange(false);
          setStep("explain");
        }, 2000);
      } else {
        setStep("denied");
        onPermissionDenied?.();
      }
    } catch (err) {
      setStep("denied");
      onPermissionDenied?.();
    } finally {
      setIsRequesting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep("explain");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === "explain" && (
          <>
            <DialogHeader>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-center">Location Access Required</DialogTitle>
              <DialogDescription className="text-center">
                To track your time at job sites, we need access to your location.
              </DialogDescription>
            </DialogHeader>

            {/* Google Play Policy Compliant Disclosure */}
            <div className="bg-muted/50 rounded-lg p-4 my-4 border border-border">
              <p className="text-sm text-foreground font-medium mb-2">
                Background Location Disclosure
              </p>
              <p className="text-xs text-muted-foreground">
                Command X collects location data to enable automatic clock-out when you leave 
                job sites, <strong>even when the app is closed or not in use</strong>. Your location 
                is only tracked while you are clocked in to a job site.
              </p>
            </div>

            <div className="space-y-4 py-2">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Your privacy is protected</p>
                  <p className="text-xs text-muted-foreground">
                    Location data is never shared with third parties or used for advertising.
                  </p>
                </div>
              </div>

              {isNative && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Background location required</p>
                    <p className="text-xs text-muted-foreground">
                      Select "Allow all the time" to enable automatic clock-out when you leave the job site.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button onClick={handleRequestPermission} className="w-full">
                Enable Location Access
              </Button>
              <Button variant="ghost" onClick={handleClose} className="w-full">
                Not Now
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "requesting" && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 animate-pulse">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Please allow location access when prompted...
            </p>
          </div>
        )}

        {step === "success" && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <DialogTitle className="text-center mb-2">Location Access Enabled</DialogTitle>
            <p className="text-sm text-muted-foreground">
              You're all set! Location tracking will work while you're clocked in.
            </p>
          </div>
        )}

        {step === "denied" && (
          <>
            <DialogHeader>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10">
                <AlertTriangle className="h-6 w-6 text-yellow-500" />
              </div>
              <DialogTitle className="text-center">Location Access Denied</DialogTitle>
              <DialogDescription className="text-center">
                Without location access, you won't be able to clock in at job sites that require location verification.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button onClick={handleRequestPermission} className="w-full">
                Try Again
              </Button>
              <Button variant="ghost" onClick={handleClose} className="w-full">
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

