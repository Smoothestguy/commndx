import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useVendorInvitationByToken } from "@/integrations/supabase/hooks/useVendorPortal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, XCircle, Building2 } from "lucide-react";

export default function AcceptVendorInvitation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { data: invitation, isLoading: invitationLoading, error } = useVendorInvitationByToken(token);
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isExpired = invitation && new Date(invitation.expires_at) < new Date();

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    
    if (!invitation) return;
    
    setLoading(true);

    try {
      let userId: string;
      let isExistingUser = false;

      // Try to create new user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: invitation.email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/vendor`,
          data: {
            vendor_name: invitation.vendor?.name,
          },
        },
      });

      if (signUpError) {
        // If user already exists, try to sign them in
        if (signUpError.message.includes('already registered') || 
            signUpError.message.includes('User already registered') ||
            (signUpError as any).code === 'user_already_exists') {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: invitation.email,
            password,
          });
          
          if (signInError) {
            throw new Error("Invalid password for existing account. Please use the correct password.");
          }
          if (!signInData.user) throw new Error("Failed to sign in");
          
          userId = signInData.user.id;
          isExistingUser = true;
        } else {
          throw signUpError;
        }
      } else {
        if (!signUpData.user) throw new Error("Failed to create user");
        userId = signUpData.user.id;
      }

      // Link vendor to auth user
      const { error: linkError } = await supabase
        .from("vendors")
        .update({ user_id: userId })
        .eq("id", invitation.vendor_id);

      if (linkError) throw linkError;

      // Assign vendor role (upsert to handle existing users)
      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert(
          { user_id: userId, role: "vendor" as any },
          { onConflict: 'user_id,role' }
        );

      if (roleError) throw roleError;

      // Mark invitation as accepted
      const { error: inviteError } = await supabase
        .from("vendor_invitations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", invitation.id);

      if (inviteError) throw inviteError;

      if (isExistingUser) {
        toast.success("Account linked successfully!");
        navigate("/vendor");
      } else {
        toast.success("Account created successfully! Please check your email to verify.");
        navigate("/vendor/login");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  if (invitationLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invalid Invitation</h2>
            <p className="text-muted-foreground text-center mb-4">
              This invitation link is invalid or has already been used.
            </p>
            <Button variant="outline" onClick={() => navigate("/vendor/login")}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invitation Expired</h2>
            <p className="text-muted-foreground text-center mb-4">
              This invitation has expired. Please contact your administrator for a new invitation.
            </p>
            <Button variant="outline" onClick={() => navigate("/vendor/login")}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 w-fit">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome!</CardTitle>
          <CardDescription>
            You've been invited to join the Vendor Portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg mb-6">
            <p className="text-sm text-muted-foreground">Invitation for:</p>
            <p className="font-medium">{invitation.vendor?.name}</p>
            <p className="text-sm text-muted-foreground">{invitation.email}</p>
          </div>
          
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Create Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Account
            </Button>
          </form>
          
          <p className="text-sm text-center text-muted-foreground mt-6">
            Already have an account?{" "}
            <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/vendor/login")}>
              Sign in
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
