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
import { AlertTriangle } from "lucide-react";

interface LocationPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocationPermissionDialog({
  open,
  onOpenChange,
}: LocationPermissionDialogProps) {
  const [expanded, setExpanded] = useState<string | undefined>(undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Location Access Required
          </DialogTitle>
          <DialogDescription>
            Location access is required for this project. Please enable it in your browser settings to continue.
          </DialogDescription>
        </DialogHeader>

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

        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
