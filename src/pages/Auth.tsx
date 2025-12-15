import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { ParticleBackground } from "@/components/ui/particle-background";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const Auth = () => {
  const navigate = useNavigate();
  const { user, signIn, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Check for unlinked personnel/vendor and redirect appropriately
  useEffect(() => {
    if (user && !authLoading) {
      const checkAndRedirect = async () => {
        // Check if user email matches an unlinked personnel record
        const { data: personnel } = await supabase
          .from("personnel")
          .select("id, user_id")
          .eq("email", user.email || "")
          .maybeSingle();

        if (personnel && !personnel.user_id) {
          // Link the personnel record to this user
          await supabase
            .from("personnel")
            .update({ user_id: user.id })
            .eq("id", personnel.id);

          // Remove any auto-assigned role
          await supabase
            .from("user_roles")
            .delete()
            .eq("user_id", user.id);

          navigate("/portal");
          return;
        }

        // Check if already linked personnel
        if (personnel && personnel.user_id === user.id) {
          navigate("/portal");
          return;
        }

        // Check if user email matches an unlinked vendor record
        const { data: vendor } = await supabase
          .from("vendors")
          .select("id, user_id")
          .eq("email", user.email || "")
          .maybeSingle();

        if (vendor && !vendor.user_id) {
          // Link the vendor record to this user
          await supabase
            .from("vendors")
            .update({ user_id: user.id })
            .eq("id", vendor.id);

          // Remove any auto-assigned role
          await supabase
            .from("user_roles")
            .delete()
            .eq("user_id", user.id);

          navigate("/vendor");
          return;
        }

        // Check if already linked vendor
        if (vendor && vendor.user_id === user.id) {
          navigate("/vendor");
          return;
        }

        // Regular user goes to dashboard
        navigate("/");
      };

      checkAndRedirect();
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Logged in successfully");
    }
    setIsLoading(false);
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
              src={logo} 
              alt="Fairfield"
              className="h-12 sm:h-14 md:h-16 lg:h-20 w-auto max-w-[250px] sm:max-w-[280px] md:max-w-[300px] object-contain" 
            />
          </div>
          <CardDescription>
            Sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input 
                id="login-email" 
                type="email" 
                placeholder="you@example.com" 
                value={loginEmail} 
                onChange={e => setLoginEmail(e.target.value)} 
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
                onChange={e => setLoginPassword(e.target.value)} 
                required 
                className="bg-secondary border-border" 
              />
            </div>
            <Button type="submit" className="w-full" variant="glow" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
