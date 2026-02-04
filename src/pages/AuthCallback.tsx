import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Session } from "@supabase/supabase-js";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [processed, setProcessed] = useState(false);

  const handleAuthenticatedUser = useCallback(async (session: Session) => {
    if (processed) return;
    setProcessed(true);

    try {
      const user = session.user;
      const userEmail = user.email;

      // Check for existing profile and create if needed
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (!existingProfile) {
        // Profile should be created by trigger, but ensure it exists
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({
            id: user.id,
            email: userEmail,
            first_name: user.user_metadata?.first_name || user.user_metadata?.full_name?.split(" ")[0] || "",
            last_name: user.user_metadata?.last_name || user.user_metadata?.full_name?.split(" ").slice(1).join(" ") || "",
          });

        if (profileError) {
          console.error("Profile creation error:", profileError);
        }
      }

      // Check if user email matches an unlinked personnel record
      const { data: personnel } = await supabase
        .from("personnel")
        .select("id, user_id")
        .eq("email", userEmail || "")
        .maybeSingle();

      if (personnel && !personnel.user_id) {
        // Link the personnel record to this user
        await supabase
          .from("personnel")
          .update({ user_id: user.id })
          .eq("id", personnel.id);

        toast.success("Welcome! Redirecting to your portal...");
        navigate("/portal");
        return;
      }

      if (personnel && personnel.user_id === user.id) {
        navigate("/portal");
        return;
      }

      // Check if user email matches an unlinked vendor record
      const { data: vendor } = await supabase
        .from("vendors")
        .select("id, user_id")
        .eq("email", userEmail || "")
        .maybeSingle();

      if (vendor && !vendor.user_id) {
        // Link the vendor record to this user
        await supabase
          .from("vendors")
          .update({ user_id: user.id })
          .eq("id", vendor.id);

        toast.success("Welcome! Redirecting to vendor portal...");
        navigate("/vendor");
        return;
      }

      if (vendor && vendor.user_id === user.id) {
        navigate("/vendor");
        return;
      }

      // Check if user has a valid role (authorized user)
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      // If no personnel link, no vendor link, and no role - unauthorized
      if (!userRole) {
        // Sign out the unauthorized user to prevent lingering sessions
        await supabase.auth.signOut();
        toast.error("Access denied. Your account is not authorized.");
        navigate("/unauthorized");
        return;
      }

      // Authorized user with role goes to dashboard
      toast.success("Logged in successfully");
      navigate("/");
    } catch (err) {
      console.error("Auth callback exception:", err);
      setError("An unexpected error occurred");
      // Sign out on error to prevent partial auth state
      await supabase.auth.signOut();
      toast.error("Authentication failed. Please try again.");
      setTimeout(() => navigate("/auth"), 2000);
    }
  }, [navigate, processed]);

  useEffect(() => {
    // Listen for auth state changes - this handles OAuth callbacks properly
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("[AuthCallback] Auth event:", event, "Session:", !!session);

        if (event === 'SIGNED_IN' && session) {
          // OAuth completed successfully
          await handleAuthenticatedUser(session);
        } else if (event === 'INITIAL_SESSION') {
          if (session) {
            // Already have a session
            await handleAuthenticatedUser(session);
          } else {
            // Check if we have tokens in the URL hash (OAuth callback)
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const accessToken = hashParams.get('access_token');

            if (!accessToken) {
              // No tokens in URL and no session - something went wrong
              console.log("[AuthCallback] No session and no tokens in URL");
              setError("No session found");
              toast.error("Authentication failed. Please try again.");
              setTimeout(() => navigate("/auth"), 2000);
            }
            // If tokens exist, wait for SIGNED_IN event
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate, handleAuthenticatedUser]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error}</p>
        <p className="text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground">Completing sign in...</p>
    </div>
  );
};

export default AuthCallback;
