import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, CheckCircle } from "lucide-react";
import { Vendor } from "@/integrations/supabase/hooks/useVendors";
import { SendVendorOnboardingDialog } from "./SendVendorOnboardingDialog";

interface SendOnboardingSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendors: Vendor[];
}

export function SendOnboardingSearchDialog({
  open,
  onOpenChange,
  vendors,
}: SendOnboardingSearchDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  const normalizePhone = (value: string) => value.replace(/\D/g, "");

  const filteredVendors = vendors.filter((v) => {
    if (!search.trim()) return true;
    const lower = search.toLowerCase();
    const phoneSearch = normalizePhone(search);
    return (
      v.name.toLowerCase().includes(lower) ||
      v.email.toLowerCase().includes(lower) ||
      (v.phone && phoneSearch.length > 0 && normalizePhone(v.phone).includes(phoneSearch))
    );
  });

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setSearch("");
      setSelectedVendor(null);
    }
    onOpenChange(isOpen);
  };

  return (
    <>
      <Dialog open={open && !selectedVendor} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Onboarding
            </DialogTitle>
            <DialogDescription>
              Search for a vendor by name, email, or phone number to send an onboarding invitation.
            </DialogDescription>
          </DialogHeader>

          <SearchInput
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={setSearch}
            autoFocus
          />

          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredVendors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No vendors found.
              </p>
            ) : (
              filteredVendors.map((vendor) => {
                const isCompleted = vendor.onboarding_status === "completed";
                return (
                  <button
                    key={vendor.id}
                    disabled={isCompleted}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-2 transition-colors"
                    onClick={() => setSelectedVendor(vendor)}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{vendor.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {vendor.email}
                        {vendor.phone && ` · ${vendor.phone}`}
                      </p>
                    </div>
                    {isCompleted ? (
                      <Badge variant="outline" className="shrink-0 text-xs bg-green-500/10 text-green-600 border-green-500/20">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Onboarded
                      </Badge>
                    ) : vendor.onboarding_status === "invited" ? (
                      <Badge variant="outline" className="shrink-0 text-xs">
                        Invited
                      </Badge>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedVendor && (
        <SendVendorOnboardingDialog
          open={!!selectedVendor}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setSelectedVendor(null);
              handleClose(false);
            }
          }}
          vendorId={selectedVendor.id}
          vendorName={selectedVendor.name}
          vendorEmail={selectedVendor.email}
        />
      )}
    </>
  );
}
