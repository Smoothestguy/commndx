import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { ParticleBackground } from "@/components/ui/particle-background";
import { Loader2, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import logoDark from "@/assets/logo-dark.png";
import { GoogleIcon } from "@/components/icons/GoogleIcon";
import { AppleIcon } from "@/components/icons/AppleIcon";
import { PortalSwitcherModal } from "@/components/PortalSwitcherModal";
import { usePortalSwitcher } from "@/hooks/usePortalSwitcher";
import { NetworkErrorBanner } from "@/components/auth/NetworkErrorBanner";
import { isNetworkError } from "@/utils/authNetwork";
import { supabase } from "@/integrations/supabase/client";
import { usePublicSigninProviders } from "@/hooks/useSigninProviders";

const Auth = () => {
  const navigate = useNavigate();
  const { theme, resolvedTheme } = useTheme();
  const { user, signIn, signInWithGoogle, signInWithApple, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [showNetworkError, setShowNetworkError] = useState(false);
  const [showAuthFallback, setShowAuthFallback] = useState(false);
  const {
    isOpen: isPortalSwitcherOpen,
    setIsOpen: setPortalSwitcherOpen,
    openSwitcher,
  } = usePortalSwitcher();

  const { data: providers } = usePublicSigninProviders();

  const currentTheme = resolvedTheme || theme;

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Simply redirect logged-in users away from auth page
  // Authorization checks are handled by ProtectedRoute and AuthCallback
  useEffect(() => {
    if (user && !authLoading) {
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading) {
      setShowAuthFallback(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowAuthFallback(true);
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [authLoading]);


  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsLoading(true);
    setShowNetworkError(false);
    
    try {
      const { error } = await signIn(loginEmail, loginPassword);
      if (error) {
        // Check if the error message indicates a network issue
        if (isNetworkError(error) || error.message.includes("Can't reach") || error.message.includes("check your connection")) {
          setShowNetworkError(true);
        }
        toast.error(error.message);
      } else {
        toast.success("Logged in successfully");
      }
    } finally {
      setIsLoading(false);
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
        toast.error(error.message);
        setIsOAuthLoading(false);
      }
    } catch {
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
        toast.error(error.message);
        setIsOAuthLoading(false);
      }
    } catch {
      setIsOAuthLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    setIsOAuthLoading(true);
    setShowNetworkError(false);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "facebook",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        toast.error(error.message);
        setIsOAuthLoading(false);
      }
    } catch {
      setIsOAuthLoading(false);
    }
  };


  const handleRetry = () => {
    setShowNetworkError(false);
    if (loginEmail && loginPassword) {
      handleLogin();
    }
  };

  if (authLoading && !showAuthFallback) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center gap-5 text-center">
          <img
            src={currentTheme === "light" ? logoDark : logo}
            alt="Fairfield"
            className="h-16 w-auto max-w-[280px] object-contain"
          />
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm font-medium">Loading Command X</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4 overflow-hidden">
      <SEO
        title="Sign In"
        description="Sign in to access Command X business management platform"
        keywords="sign in, login, authentication"
        noIndex={true}
      />
      {/* Aurora Background Waves */}
      <div className="aurora-bg absolute inset-0 z-0" />

      {/* Additional floating elements for depth */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-aurora-float-1" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-aurora-float-2" />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-purple-500/15 rounded-full blur-3xl animate-aurora-float-3" />
      </div>

      {/* Particle Animation Layer */}
      <ParticleBackground className="z-[1]" particleCount={60} />

      <Card className="relative z-10 w-full max-w-md glass">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img
              src={currentTheme === "light" ? logoDark : logo}
              alt="Fairfield"
              className="h-12 sm:h-14 md:h-16 lg:h-20 w-auto max-w-[250px] sm:max-w-[280px] md:max-w-[300px] object-contain"
            />
          </div>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* OAuth Buttons */}
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full bg-secondary/50 border-border hover:bg-secondary"
              onClick={handleGoogleLogin}
              disabled={isOAuthLoading}
            >
              {isOAuthLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <GoogleIcon className="mr-2 h-5 w-5" />
              )}
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full bg-secondary/50 border-border hover:bg-secondary"
              onClick={handleAppleLogin}
              disabled={isOAuthLoading}
            >
              {isOAuthLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <AppleIcon className="mr-2 h-5 w-5" />
              )}
              Continue with Apple
            </Button>
            {providers?.staff_facebook_enabled && (
              <Button
                type="button"
                variant="outline"
                className="w-full bg-secondary/50 border-border hover:bg-secondary"
                onClick={handleFacebookLogin}
                disabled={isOAuthLoading}
              >
                {isOAuthLoading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
                    <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
                  </svg>
                )}
                Continue with Facebook
              </Button>
            )}

          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="bg-secondary border-border"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              variant="glow"
              disabled={isLoading || isOAuthLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>

          {/* Network Error Banner */}
          {showNetworkError && (
            <NetworkErrorBanner onRetry={handleRetry} isRetrying={isLoading} />
          )}

          {/* Portal Switcher */}
          <div className="pt-4 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={openSwitcher}
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Switch to Personnel or Vendor Portal
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-2">
              <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[10px]">
                ⌘
              </kbd>{" "}
              +{" "}
              <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[10px]">
                ⇧
              </kbd>{" "}
              +{" "}
              <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[10px]">
                P
              </kbd>
            </p>
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
};

export default Auth;
