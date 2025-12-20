import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithMicrosoft: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

// Audit log helper for auth events (doesn't use hook since we may not have user context)
const logAuthEvent = async (
  actionType: "sign_in" | "sign_out" | "sign_up",
  userEmail: string,
  userId?: string,
  success: boolean = true,
  errorMessage?: string
) => {
  try {
    await supabase.from("audit_logs").insert([{
      user_id: userId || null,
      user_email: userEmail,
      action_type: actionType,
      resource_type: "auth",
      resource_id: null,
      resource_number: null,
      changes_before: null,
      changes_after: null,
      ip_address: null,
      user_agent: navigator.userAgent,
      success,
      error_message: errorMessage || null,
      metadata: {}
    }]);
  } catch (err) {
    console.error("Failed to log auth event:", err);
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      });

      if (error) {
        await logAuthEvent("sign_up", email, undefined, false, error.message);
        return { error };
      }
      
      await logAuthEvent("sign_up", email, data.user?.id, true);
      return { error: null };
    } catch (error) {
      await logAuthEvent("sign_up", email, undefined, false, (error as Error).message);
      return { error: error as Error };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        await logAuthEvent("sign_in", email, undefined, false, error.message);
        return { error };
      }

      await logAuthEvent("sign_in", email, data.user?.id, true);
      navigate("/");
      return { error: null };
    } catch (error) {
      await logAuthEvent("sign_in", email, undefined, false, (error as Error).message);
      return { error: error as Error };
    }
  }, [navigate]);

  const signOut = useCallback(async () => {
    const currentEmail = user?.email || "unknown";
    const currentUserId = user?.id;
    
    await supabase.auth.signOut();
    await logAuthEvent("sign_out", currentEmail, currentUserId, true);
    navigate("/auth");
  }, [user, navigate]);

  const signInWithGoogle = useCallback(async () => {
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo }
      });
      if (error) {
        return { error };
      }
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const signInWithMicrosoft = useCallback(async () => {
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: { 
          redirectTo,
          scopes: 'email profile openid'
        }
      });
      if (error) {
        return { error };
      }
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithGoogle, signInWithMicrosoft, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
