import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { GoogleIcon } from "@/components/icons/GoogleIcon";
import { usePublicSigninProviders } from "@/hooks/useSigninProviders";

export interface SocialProfile {
  provider: "google" | "facebook";
  first_name?: string;
  last_name?: string;
  email?: string;
  picture_url?: string;
}

interface Props {
  onProfile: (profile: SocialProfile) => void | Promise<void>;
  disabled?: boolean;
}

function loadScript(src: string, id: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.getElementById(id)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.id = id;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function decodeJwtPayload(token: string): any {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Prefill-only social buttons for the public application form.
 * These never create auth accounts — they only read the provider profile
 * client-side to save the applicant typing.
 */
export function SocialPrefillButtons({ onProfile, disabled }: Props) {
  const { data: providers } = usePublicSigninProviders();
  const [busy, setBusy] = useState<null | "google" | "facebook">(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const googleOn = !!providers?.apply_google_enabled && !!providers?.google_client_id;
  const facebookOn = !!providers?.apply_facebook_enabled && !!providers?.facebook_app_id;

  const handleGoogleCredential = useCallback(
    async (response: any) => {
      const payload = decodeJwtPayload(response?.credential ?? "");
      if (!payload) return;
      setBusy("google");
      try {
        await onProfile({
          provider: "google",
          first_name: payload.given_name,
          last_name: payload.family_name,
          email: payload.email,
          picture_url: payload.picture,
        });
      } finally {
        setBusy(null);
      }
    },
    [onProfile]
  );

  // Google Identity Services — loaded only when enabled and configured.
  useEffect(() => {
    if (!googleOn) return;
    let cancelled = false;
    loadScript("https://accounts.google.com/gsi/client", "google-gsi-client")
      .then(() => {
        if (cancelled) return;
        const g = (window as any).google;
        if (!g?.accounts?.id || !googleBtnRef.current) return;
        g.accounts.id.initialize({
          client_id: providers!.google_client_id,
          callback: handleGoogleCredential,
        });
        g.accounts.id.renderButton(googleBtnRef.current, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          width: 260,
        });
      })
      .catch((err) => console.warn("[SocialPrefill] Google SDK unavailable", err));
    return () => {
      cancelled = true;
    };
  }, [googleOn, providers, handleGoogleCredential]);

  const handleFacebook = useCallback(async () => {
    if (!facebookOn) return;
    setBusy("facebook");
    try {
      await loadScript("https://connect.facebook.net/en_US/sdk.js", "facebook-jssdk");
      const FB = (window as any).FB;
      if (!FB) throw new Error("FB SDK not available");
      FB.init({ appId: providers!.facebook_app_id, cookie: true, xfbml: false, version: "v19.0" });
      FB.login(
        (loginRes: any) => {
          if (!loginRes?.authResponse) {
            setBusy(null);
            return;
          }
          FB.api(
            "/me",
            { fields: "first_name,last_name,email,picture.width(600).height(600)" },
            async (me: any) => {
              try {
                await onProfile({
                  provider: "facebook",
                  first_name: me?.first_name,
                  last_name: me?.last_name,
                  email: me?.email,
                  picture_url: me?.picture?.data?.url,
                });
              } finally {
                setBusy(null);
              }
            }
          );
        },
        { scope: "public_profile,email" }
      );
    } catch (err) {
      console.warn("[SocialPrefill] Facebook SDK unavailable", err);
      setBusy(null);
    }
  }, [facebookOn, providers, onProfile]);

  if (!googleOn && !facebookOn) return null;

  return (
    <div className="rounded-lg border bg-card/60 p-4">
      <p className="mb-3 text-sm font-medium">Save time — fill this in with:</p>
      <div className="flex flex-wrap items-center gap-3">
        {googleOn && (
          <div className="flex items-center gap-2">
            <div ref={googleBtnRef} />
            {busy === "google" && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        )}
        {facebookOn && (
          <Button
            type="button"
            variant="outline"
            onClick={handleFacebook}
            disabled={disabled || busy !== null}
          >
            {busy === "facebook" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
                <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
              </svg>
            )}
            Continue with Facebook
          </Button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        We only use this to fill in your name, email and photo. No account is created.
      </p>
    </div>
  );
}

export { GoogleIcon };
