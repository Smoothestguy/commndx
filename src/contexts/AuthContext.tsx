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

// Check if running in Electron - multiple detection methods for robustness
const isElectron = () => {
  if (typeof window === "undefined") return false;

  // Primary check: our exposed API
  if (window.electronAPI?.isElectron === true) return true;

  // Fallback checks for Electron environment
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("electron")) return true;

  // Check for Electron-specific properties
  if (
    typeof window.process !== "undefined" &&
    (window.process as { type?: string })?.type === "renderer"
  )
    return true;

  return false;
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
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[Auth] Auth state change:", event);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Check for existing session with timeout and error handling
    const checkSession = async () => {
      try {
        // Add a timeout to prevent hanging
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Session check timeout")), 5000);
        });

        const sessionPromise = supabase.auth.getSession();

        const { data: { session }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise.then(() => { throw new Error("Timeout"); })
        ]) as Awaited<typeof sessionPromise>;

        if (error) {
          console.error("[Auth] Error getting session:", error);
          // Clear potentially corrupted session
          await supabase.auth.signOut();
        }

        setSession(session);
        setUser(session?.user ?? null);
      } catch (err) {
        console.error("[Auth] Session check failed:", err);
        // Clear localStorage on failure to break the loop
        try {
          localStorage.removeItem(`sb-${import.meta.env.VITE_SUPABASE_PROJECT_ID}-auth-token`);
        } catch (e) {
          console.error("[Auth] Failed to clear auth token:", e);
        }
      } finally {
        setLoading(false);
      }
    };

    checkSession();

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
          logAuthEvent("sign_up", email, undefined, false, error.message).catch(console.error);
          return { error };
        }

        logAuthEvent("sign_up", email, data.user?.id, true).catch(console.error);
        return { error: null };
      } catch (error) {
        logAuthEvent(
          "sign_up",
          email,
          undefined,
          false,
          (error as Error).message
        ).catch(console.error);
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
          logAuthEvent("sign_in", email, undefined, false, error.message).catch(console.error);
          return { error };
        }

        logAuthEvent("sign_in", email, data.user?.id, true).catch(console.error);
        navigate("/");
        return { error: null };
      } catch (error) {
        logAuthEvent(
          "sign_in",
          email,
          undefined,
          false,
          (error as Error).message
        ).catch(console.error);
        return { error: error as Error };
      }
    },
    [navigate]
  );

  const signOut = useCallback(async () => {
    const currentEmail = user?.email || "unknown";
    const currentUserId = user?.id;

    await supabase.auth.signOut();
    logAuthEvent("sign_out", currentEmail, currentUserId, true).catch(console.error);
    navigate("/auth");
  }, [user, navigate]);

  const signInWithGoogle = useCallback(async () => {
    try {
      const electronDetected = isElectron();
      console.log(
        "[Auth] signInWithGoogle called, isElectron:",
        electronDetected
      );
      console.log("[Auth] window.electronAPI:", window.electronAPI);
      console.log("[Auth] userAgent:", navigator.userAgent);

      // For Electron: use Supabase OAuth directly (opens in external browser)
      if (electronDetected) {
        // Use Supabase OAuth with redirect to desktop callback page
        const redirectTo = "https://fairfieldrg.com/auth/desktop-callback";
        console.log(
          "[Auth] Using Supabase OAuth for Electron, redirectTo:",
          redirectTo
        );

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
            skipBrowserRedirect: true, // Don't redirect the Electron window
          },
        });

        console.log("[Auth] Supabase OAuth response:", {
          url: data?.url,
          error,
        });

        if (error) {
          return { error };
        }

        // Open the OAuth URL in the external browser
        if (data?.url) {
          console.log(
            "[Auth] Opening OAuth URL in external browser:",
            data.url
          );
          await window.electronAPI?.openExternal(data.url);
        }
        return { error: null };
      }

      console.log("[Auth] Using Lovable OAuth for web");
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
        // Use fairfieldrg.com as the OAuth host (Lovable's configured domain)
        const oauthHost =
          import.meta.env.VITE_OAUTH_HOST || "https://fairfieldrg.com";
        const redirectUri = `${oauthHost}/auth/desktop-callback`;

        // Build the OAuth URL and open in external browser
        const params = new URLSearchParams({
          provider: "apple",
          redirect_uri: redirectUri,
          state: crypto.randomUUID(),
        });
        const oauthUrl = `/~oauth/initiate?${params.toString()}`;

        // Open in external browser - the callback page will redirect to commandx://
        await window.electronAPI?.openExternal(`${oauthHost}${oauthUrl}`);
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
