import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Mail, KeyRound } from "lucide-react";
import { useSendVendorPortalInvitation } from "@/integrations/supabase/hooks/useVendorPortal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface InviteVendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  vendorEmail: string;
  vendorName: string;
}

export function InviteVendorDialog({
  open,
  onOpenChange,
  vendorId,
  vendorEmail,
  vendorName,
}: InviteVendorDialogProps) {
  const [inviteMethod, setInviteMethod] = useState<"email" | "create">("email");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sendCredentials, setSendCredentials] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const sendInvitation = useSendVendorPortalInvitation();

  const handleSubmit = async () => {
    if (inviteMethod === "email") {
      sendInvitation.mutate(
        { vendorId, email: vendorEmail, vendorName },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      // Create account immediately
      if (!password) {
        toast.error("Password is required");
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
      if (password.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }

      setIsCreating(true);
      try {
        const { data, error } = await supabase.functions.invoke("create-user-manually", {
          body: {
            email: vendorEmail,
            password,
            firstName: vendorName.split(" ")[0] || "",
            lastName: vendorName.split(" ").slice(1).join(" ") || "",
            role: "vendor",
            vendorId,
          },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        toast.success("Vendor account created successfully");
        
        if (sendCredentials) {
          toast.info("Credentials email feature coming soon");
        }
        
        onOpenChange(false);
        // Reset form
        setPassword("");
        setConfirmPassword("");
      } catch (error: any) {
        console.error("Error creating vendor account:", error);
        toast.error(error.message || "Failed to create account");
      } finally {
        setIsCreating(false);
      }
    }
  };

  const isPending = sendInvitation.isPending || isCreating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Grant Portal Access</DialogTitle>
          <DialogDescription>
            Choose how to give {vendorName} access to the vendor portal
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <RadioGroup value={inviteMethod} onValueChange={(v) => setInviteMethod(v as "email" | "create")}>
            <div className="flex items-start space-x-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/50"
                 onClick={() => setInviteMethod("email")}>
              <RadioGroupItem value="email" id="email" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="email" className="font-medium cursor-pointer flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Send Email Invitation
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Vendor will receive an email with a link to create their own password
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/50"
                 onClick={() => setInviteMethod("create")}>
              <RadioGroupItem value="create" id="create" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="create" className="font-medium cursor-pointer flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Create Account Now
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Set a password immediately and optionally email them the credentials
                </p>
              </div>
            </div>
          </RadioGroup>

          {inviteMethod === "create" && (
            <div className="space-y-4 pl-6 border-l-2 border-primary/20 ml-3">
              <div className="space-y-2">
                <Label htmlFor="email-display">Email</Label>
                <Input
                  id="email-display"
                  value={vendorEmail}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-credentials"
                  checked={sendCredentials}
                  onCheckedChange={(checked) => setSendCredentials(checked as boolean)}
                />
                <Label htmlFor="send-credentials" className="text-sm cursor-pointer">
                  Send login credentials via email
                </Label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {inviteMethod === "email" ? "Send Invitation" : "Create Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
