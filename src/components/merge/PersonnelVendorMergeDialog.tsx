import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Building2, Mail, Phone, Link2, Check, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface PersonnelVendorMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personnelId: string;
  personnelName: string;
  personnelEmail: string;
  personnelPhone?: string | null;
  currentVendorId?: string | null;
  onMergeComplete?: () => void;
}

interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  status: string;
}

export function PersonnelVendorMergeDialog({
  open,
  onOpenChange,
  personnelId,
  personnelName,
  personnelEmail,
  personnelPhone,
  currentVendorId,
  onMergeComplete,
}: PersonnelVendorMergeDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);
  const queryClient = useQueryClient();

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSearchQuery(personnelName);
      setSelectedVendor(null);
      setConfirmStep(false);
    }
  }, [open, personnelName]);

  // Search for matching vendors
  const { data: vendors, isLoading } = useQuery({
    queryKey: ["vendor-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];

      let query = supabase
        .from("vendors")
        .select("id, name, email, phone, company, status")
        .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);

      // Only exclude current vendor if one is linked
      if (currentVendorId) {
        query = query.neq("id", currentVendorId);
      }

      const { data, error } = await query
        .order("name")
        .limit(20);

      if (error) throw error;
      return data as Vendor[];
    },
    enabled: open && searchQuery.length > 1,
  });

  // Link personnel to vendor mutation
  const linkMutation = useMutation({
    mutationFn: async (vendorId: string) => {
      const { error } = await supabase
        .from("personnel")
        .update({ vendor_id: vendorId })
        .eq("id", personnelId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      queryClient.invalidateQueries({ queryKey: ["personnel", personnelId] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success(`${personnelName} linked to vendor ${selectedVendor?.name}`);
      onOpenChange(false);
      onMergeComplete?.();
    },
    onError: (error: Error) => {
      toast.error(`Failed to link: ${error.message}`);
    },
  });

  const handleSelectVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setConfirmStep(true);
  };

  const handleConfirmLink = () => {
    if (selectedVendor) {
      linkMutation.mutate(selectedVendor.id);
    }
  };

  const isAlreadyLinked = (vendorId: string) => vendorId === currentVendorId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {confirmStep ? "Confirm Link" : "Link Personnel to Vendor"}
          </DialogTitle>
          <DialogDescription>
            {confirmStep
              ? `Link ${personnelName} to the selected vendor record.`
              : `Find and link ${personnelName} to an existing vendor record.`}
          </DialogDescription>
        </DialogHeader>

        {!confirmStep ? (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Search Vendors</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium">Personnel Details:</p>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>{personnelName}</span>
                  {personnelEmail && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{personnelEmail}</span>}
                  {personnelPhone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{personnelPhone}</span>}
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0 max-h-[300px]">
              <div className="space-y-2 pr-4">
                {isLoading ? (
                  <>
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </>
                ) : vendors && vendors.length > 0 ? (
                  vendors.map((vendor) => (
                    <Card
                      key={vendor.id}
                      className={`cursor-pointer transition-colors hover:bg-accent ${
                        isAlreadyLinked(vendor.id) ? "opacity-50" : ""
                      }`}
                      onClick={() => !isAlreadyLinked(vendor.id) && handleSelectVendor(vendor)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{vendor.name}</span>
                              {isAlreadyLinked(vendor.id) && (
                                <Badge variant="secondary" className="gap-1">
                                  <Check className="h-3 w-3" />
                                  Current
                                </Badge>
                              )}
                              {vendor.status === "inactive" && (
                                <Badge variant="outline">Inactive</Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                              {vendor.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {vendor.email}
                                </span>
                              )}
                              {vendor.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {vendor.phone}
                                </span>
                              )}
                              {vendor.company && (
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {vendor.company}
                                </span>
                              )}
                            </div>
                          </div>
                          {!isAlreadyLinked(vendor.id) && (
                            <Button variant="outline" size="sm">
                              Select
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : searchQuery.length > 1 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No vendors found matching "{searchQuery}"
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Enter a search term to find vendors
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="font-medium text-amber-700 dark:text-amber-400">Confirm Link</p>
                  <p className="text-sm text-muted-foreground">
                    This will link the personnel record to the vendor. All financial records 
                    (bills, payments) will be tracked under the vendor.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Personnel</p>
                  <p className="font-medium">{personnelName}</p>
                  {personnelEmail && <p className="text-sm text-muted-foreground">{personnelEmail}</p>}
                  {personnelPhone && <p className="text-sm text-muted-foreground">{personnelPhone}</p>}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Link to Vendor</p>
                  <p className="font-medium">{selectedVendor?.name}</p>
                  {selectedVendor?.email && <p className="text-sm text-muted-foreground">{selectedVendor.email}</p>}
                  {selectedVendor?.phone && <p className="text-sm text-muted-foreground">{selectedVendor.phone}</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <DialogFooter>
          {confirmStep ? (
            <>
              <Button variant="outline" onClick={() => setConfirmStep(false)}>
                Back
              </Button>
              <Button onClick={handleConfirmLink} disabled={linkMutation.isPending}>
                {linkMutation.isPending ? "Linking..." : "Confirm Link"}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
