import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useNavigate } from "react-router-dom";

// Check if running in Electron
const isElectron = () => {
  return (
    typeof window !== "undefined" && window.electronAPI?.isElectron === true
  );
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithApple: () => Promise<{ error: Error | null }>;
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
    await supabase.from("audit_logs").insert([
      {
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
        metadata: {},
      },
    ]);
  } catch (err) {
    console.error("Failed to log auth event:", err);
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const deepLinkListenerSet = useRef(false);

  useEffect(() => {
    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Set up deep link listener for Electron OAuth callbacks
  useEffect(() => {
    if (!isElectron() || deepLinkListenerSet.current) return;
    deepLinkListenerSet.current = true;

    console.log("[Auth] Setting up Electron deep link listener");

    window.electronAPI?.onDeepLink(async (url: string) => {
      console.log("[Auth] Deep link received:", url);

      try {
        // Parse the deep link URL: commandx://auth/callback#access_token=...&refresh_token=...
        const urlObj = new URL(url);

        // The tokens might be in the hash or search params
        const hashParams = new URLSearchParams(urlObj.hash.substring(1));
        const searchParams = urlObj.searchParams;

        const accessToken =
          hashParams.get("access_token") || searchParams.get("access_token");
        const refreshToken =
          hashParams.get("refresh_token") || searchParams.get("refresh_token");

        if (accessToken && refreshToken) {
          console.log("[Auth] Setting session from deep link tokens");
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error("[Auth] Failed to set session:", error);
          } else {
            console.log("[Auth] Session set successfully from deep link");
            navigate("/");
          }
        } else {
          console.warn("[Auth] Deep link missing tokens:", url);
        }
      } catch (err) {
        console.error("[Auth] Error handling deep link:", err);
      }
    });
  }, [navigate]);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      firstName: string,
      lastName: string
    ) => {
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
        await logAuthEvent(
          "sign_up",
          email,
          undefined,
          false,
          (error as Error).message
        );
        return { error: error as Error };
      }
    },
    []
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
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
        await logAuthEvent(
          "sign_in",
          email,
          undefined,
          false,
          (error as Error).message
        );
        return { error: error as Error };
      }
    },
    [navigate]
  );

  const signOut = useCallback(async () => {
    const currentEmail = user?.email || "unknown";
    const currentUserId = user?.id;

    await supabase.auth.signOut();
    await logAuthEvent("sign_out", currentEmail, currentUserId, true);
    navigate("/auth");
  }, [user, navigate]);

  const signInWithGoogle = useCallback(async () => {
    try {
      // For Electron: open OAuth in external browser
      if (isElectron()) {
        const redirectUri = `${
          import.meta.env.VITE_APP_URL || "https://commndx.com"
        }/auth/desktop-callback`;

        // Build the OAuth URL and open in external browser
        const params = new URLSearchParams({
          provider: "google",
          redirect_uri: redirectUri,
          state: crypto.randomUUID(),
        });
        const oauthUrl = `/~oauth/initiate?${params.toString()}`;

        // Open in external browser - the callback page will redirect to commandx://
        await window.electronAPI?.openExternal(
          `https://commndx.com${oauthUrl}`
        );
        return { error: null };
      }

      // For web: use normal Lovable OAuth flow
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });

      if (error) {
        return { error };
      }
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    try {
      // For Electron: open OAuth in external browser
      if (isElectron()) {
        const redirectUri = `${
          import.meta.env.VITE_APP_URL || "https://commndx.com"
        }/auth/desktop-callback`;

        // Build the OAuth URL and open in external browser
        const params = new URLSearchParams({
          provider: "apple",
          redirect_uri: redirectUri,
          state: crypto.randomUUID(),
        });
        const oauthUrl = `/~oauth/initiate?${params.toString()}`;

        // Open in external browser - the callback page will redirect to commandx://
        await window.electronAPI?.openExternal(
          `https://commndx.com${oauthUrl}`
        );
        return { error: null };
      }

      // For web: use normal Lovable OAuth flow
      const { error } = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: window.location.origin,
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
        provider: "azure",
        options: {
          redirectTo,
          scopes: "email profile openid",
        },
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
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signInWithApple,
        signInWithMicrosoft,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
