import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the session from the URL hash/query params
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Auth callback error:", sessionError);
          setError(sessionError.message);
          toast.error("Authentication failed: " + sessionError.message);
          setTimeout(() => navigate("/auth"), 2000);
          return;
        }

        if (!session) {
          setError("No session found");
          toast.error("Authentication failed. Please try again.");
          setTimeout(() => navigate("/auth"), 2000);
          return;
        }

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
          navigate("/unauthorized");
          return;
        }

        // Authorized user with role goes to dashboard
        toast.success("Logged in successfully");
        navigate("/");
      } catch (err) {
        console.error("Auth callback exception:", err);
        setError("An unexpected error occurred");
        toast.error("Authentication failed. Please try again.");
        setTimeout(() => navigate("/auth"), 2000);
      }
    };

    handleCallback();
  }, [navigate]);

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
