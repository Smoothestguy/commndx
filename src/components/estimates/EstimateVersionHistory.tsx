import { useState } from "react";
import { format } from "date-fns";
import { History, RotateCcw, ChevronDown, ChevronUp, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useEstimateVersions,
  useRestoreEstimateVersion,
  EstimateVersion,
} from "@/integrations/supabase/hooks/useEstimateVersions";

interface EstimateVersionHistoryProps {
  estimateId: string;
}

export function EstimateVersionHistory({ estimateId }: EstimateVersionHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<EstimateVersion | null>(null);

  const { data: versions = [], isLoading } = useEstimateVersions(estimateId);
  const restoreVersion = useRestoreEstimateVersion();

  const handleRestoreClick = (version: EstimateVersion) => {
    setSelectedVersion(version);
    setRestoreDialogOpen(true);
  };

  const handlePreviewClick = (version: EstimateVersion) => {
    setSelectedVersion(version);
    setPreviewDialogOpen(true);
  };

  const handleConfirmRestore = () => {
    if (selectedVersion) {
      restoreVersion.mutate(
        { estimateId, versionId: selectedVersion.id },
        {
          onSuccess: () => {
            setRestoreDialogOpen(false);
            setSelectedVersion(null);
          },
        }
      );
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (versions.length === 0 && !isLoading) {
    return null;
  }

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="border-border">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4" />
                  Version History
                  <Badge variant="secondary" className="ml-2">
                    {versions.length} {versions.length === 1 ? "version" : "versions"}
                  </Badge>
                </CardTitle>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading versions...</p>
              ) : (
                <div className="space-y-3">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Version {version.version_number}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(version.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                        </div>
                        {version.change_summary && (
                          <p className="text-sm text-muted-foreground truncate mt-0.5">
                            {version.change_summary}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Total: {formatCurrency(version.snapshot.total)} •{" "}
                          {version.snapshot.line_items?.length || 0} items
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreviewClick(version)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestoreClick(version)}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restore
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Version {selectedVersion?.version_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the estimate to its state from{" "}
              {selectedVersion &&
                format(new Date(selectedVersion.created_at), "MMMM d, yyyy 'at' h:mm a")}
              . Your current changes will be saved as a new version before restoring.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRestore}
              disabled={restoreVersion.isPending}
            >
              {restoreVersion.isPending ? "Restoring..." : "Restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Version {selectedVersion?.version_number} Preview</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {selectedVersion && (
              <div className="space-y-4 p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Customer</p>
                    <p className="font-medium">{selectedVersion.snapshot.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant="outline">{selectedVersion.snapshot.status}</Badge>
                  </div>
                  {selectedVersion.snapshot.project_name && (
                    <div>
                      <p className="text-sm text-muted-foreground">Project</p>
                      <p className="font-medium">{selectedVersion.snapshot.project_name}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Valid Until</p>
                    <p className="font-medium">
                      {format(new Date(selectedVersion.snapshot.valid_until), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">Line Items</p>
                  <div className="space-y-2">
                    {selectedVersion.snapshot.line_items?.map((item, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-2 bg-muted/50 rounded text-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="truncate">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} × {formatCurrency(item.unit_price)}
                          </p>
                        </div>
                        <p className="font-medium ml-4">{formatCurrency(item.total)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>{formatCurrency(selectedVersion.snapshot.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax ({selectedVersion.snapshot.tax_rate}%)</span>
                    <span>{formatCurrency(selectedVersion.snapshot.tax_amount)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-lg pt-2 border-t">
                    <span>Total</span>
                    <span>{formatCurrency(selectedVersion.snapshot.total)}</span>
                  </div>
                </div>

                {selectedVersion.snapshot.notes && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground">Notes</p>
                    <p className="text-sm">{selectedVersion.snapshot.notes}</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
