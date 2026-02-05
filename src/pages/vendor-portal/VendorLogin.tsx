import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Building2, ArrowRightLeft } from "lucide-react";
import { GoogleIcon } from "@/components/icons/GoogleIcon";
import { AppleIcon } from "@/components/icons/AppleIcon";
import { PortalSwitcherModal } from "@/components/PortalSwitcherModal";
import { usePortalSwitcher } from "@/hooks/usePortalSwitcher";
import { NetworkErrorBanner } from "@/components/auth/NetworkErrorBanner";
import { withTimeout, isNetworkError, classifyNetworkError } from "@/utils/authNetwork";

export default function VendorLogin() {
  const navigate = useNavigate();
  const { signInWithGoogle, signInWithApple } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [showNetworkError, setShowNetworkError] = useState(false);
  const {
    isOpen: isPortalSwitcherOpen,
    setIsOpen: setPortalSwitcherOpen,
    openSwitcher,
  } = usePortalSwitcher();

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setShowNetworkError(false);

    try {
      console.info(`[VendorLogin] signIn: start | origin: ${window.location.origin}`);

      const signInPromise = supabase.auth.signInWithPassword({
        email,
        password,
      });

      const { error } = await withTimeout(signInPromise, 15000, "Sign in");

      if (error) throw error;

      console.info("[VendorLogin] signIn: success, checking vendor link");
      
      // Check if user is linked to vendor
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: vendor } = await supabase
          .from("vendors")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (vendor) {
          navigate("/vendor");
        } else {
          toast.error("Your account is not linked to a vendor record");
          await supabase.auth.signOut();
        }
      }
    } catch (error: unknown) {
      console.error("[VendorLogin] signIn: exception", error);
      if (isNetworkError(error)) {
        const networkErr = classifyNetworkError(error);
        setShowNetworkError(true);
        toast.error(networkErr.userMessage);
      } else {
        toast.error((error as Error).message || "Failed to sign in");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setShowNetworkError(false);
    if (email && password) {
      handleLogin();
    }
  };

  const handleGoogleLogin = async () => {
    setIsOAuthLoading(true);
    setShowNetworkError(false);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        if (isNetworkError(error) || error.message.includes("Can't reach")) {
          setShowNetworkError(true);
        }
        throw error;
      }
      // AuthCallback will handle the redirect
    } catch (error: unknown) {
      toast.error((error as Error).message || "Failed to sign in with Google");
      setIsOAuthLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setIsOAuthLoading(true);
    setShowNetworkError(false);
    try {
      const { error } = await signInWithApple();
      if (error) {
        if (isNetworkError(error) || error.message.includes("Can't reach")) {
          setShowNetworkError(true);
        }
        throw error;
      }
      // AuthCallback will handle the redirect
    } catch (error: unknown) {
      toast.error((error as Error).message || "Failed to sign in with Apple");
      setIsOAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 w-fit">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Vendor Portal</CardTitle>
          <CardDescription>
            Sign in to view your purchase orders and submit bills
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={isOAuthLoading || loading}
            >
              {isOAuthLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <GoogleIcon className="h-4 w-4 mr-2" />
              )}
              Continue with Google
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleAppleLogin}
              disabled={isOAuthLoading || loading}
            >
              {isOAuthLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <AppleIcon className="h-4 w-4 mr-2" />
              )}
              Continue with Apple
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || isOAuthLoading}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Sign In
              </Button>
            </form>
          </div>

          {/* Network Error Banner */}
          {showNetworkError && (
            <NetworkErrorBanner onRetry={handleRetry} isRetrying={loading} />
          )}

          <p className="text-sm text-center text-muted-foreground mt-6">
            Don't have an account? Contact your administrator to receive an
            invitation.
          </p>

          {/* Portal Switcher */}
          <div className="pt-4 mt-4 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={openSwitcher}
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Switch Portal
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Portal Switcher Modal */}
      <PortalSwitcherModal
        open={isPortalSwitcherOpen}
        onOpenChange={setPortalSwitcherOpen}
      />
    </div>
  );
}
