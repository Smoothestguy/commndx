import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { MapPin, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";

interface LocationPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissionState: PermissionState | null;
  onRequestLocation: () => void;
  isRequesting: boolean;
  hasLocation: boolean;
  error: string | null;
}

export function LocationPermissionDialog({
  open,
  onOpenChange,
  permissionState,
  onRequestLocation,
  isRequesting,
  hasLocation,
  error,
}: LocationPermissionDialogProps) {
  const [expanded, setExpanded] = useState<string | undefined>(undefined);

  const handleRequestLocation = () => {
    onRequestLocation();
  };

  const isDenied = permissionState === "denied";
  const isPrompt = permissionState === "prompt" || permissionState === null;

  // If location was successfully obtained, close the dialog
  if (hasLocation && open) {
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isDenied ? (
              <>
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Location Access Denied
              </>
            ) : isRequesting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Getting Your Location
              </>
            ) : hasLocation ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Location Enabled
              </>
            ) : (
              <>
                <MapPin className="h-5 w-5 text-primary" />
                Enable Location Services
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isDenied
              ? "Location access was denied. Please enable it in your browser settings to continue."
              : isRequesting
              ? "Please wait while we get your location..."
              : hasLocation
              ? "Your location has been successfully captured."
              : "This project requires your location to clock in and out for accurate time tracking."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {isDenied && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              To enable location access, follow the instructions for your browser:
            </p>

            <Accordion
              type="single"
              collapsible
              value={expanded}
              onValueChange={setExpanded}
              className="w-full"
            >
              <AccordionItem value="chrome">
                <AccordionTrigger className="text-sm">
                  Google Chrome
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Click the lock/info icon in the address bar</li>
                    <li>Select "Site settings"</li>
                    <li>Find "Location" and change it to "Allow"</li>
                    <li>Refresh the page</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="safari">
                <AccordionTrigger className="text-sm">
                  Safari (Mac/iOS)
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p className="font-medium">On Mac:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Safari menu → Settings → Websites</li>
                    <li>Click "Location" in the sidebar</li>
                    <li>Find this website and select "Allow"</li>
                  </ol>
                  <p className="font-medium mt-2">On iPhone/iPad:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Settings → Safari → Location</li>
                    <li>Select "Ask" or "Allow"</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="firefox">
                <AccordionTrigger className="text-sm">
                  Firefox
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Click the lock icon in the address bar</li>
                    <li>Click "Connection secure" or site info</li>
                    <li>Click "More information"</li>
                    <li>Go to "Permissions" tab</li>
                    <li>Find "Access Your Location" and select "Allow"</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="edge">
                <AccordionTrigger className="text-sm">
                  Microsoft Edge
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Click the lock icon in the address bar</li>
                    <li>Click "Permissions for this site"</li>
                    <li>Find "Location" and change it to "Allow"</li>
                    <li>Refresh the page</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}

        {!isDenied && !isRequesting && !hasLocation && (
          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="text-muted-foreground">
              When you click the button below, your browser will ask for permission
              to access your location. Please click <strong>"Allow"</strong> to continue.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {!hasLocation && (
            <Button onClick={handleRequestLocation} disabled={isRequesting}>
              {isRequesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Getting Location...
                </>
              ) : isDenied ? (
                "Try Again"
              ) : (
                "Enable Location"
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
