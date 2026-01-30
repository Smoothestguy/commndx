import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Desktop OAuth Callback Page
 * 
 * This page handles OAuth callbacks for the desktop (Electron) app.
 * After OAuth authentication, the browser redirects here with tokens in the URL hash.
 * This page then redirects to the commandx:// custom protocol to send the tokens
 * back to the Electron app.
 */
const DesktopCallback = () => {
  const [status, setStatus] = useState<"redirecting" | "error">("redirecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Get the tokens from the URL hash
      // The OAuth provider redirects with: /auth/desktop-callback#access_token=...&refresh_token=...
      const hash = window.location.hash.substring(1);
      const hashParams = new URLSearchParams(hash);
      
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const error = hashParams.get("error");
      const errorDescription = hashParams.get("error_description");

      if (error) {
        setStatus("error");
        setErrorMessage(errorDescription || error);
        return;
      }

      if (!accessToken || !refreshToken) {
        setStatus("error");
        setErrorMessage("Missing authentication tokens. Please try signing in again.");
        return;
      }

      // Construct the deep link URL for the desktop app
      const deepLinkUrl = `commandx://auth/callback#access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}`;

      console.log("[DesktopCallback] Redirecting to desktop app:", deepLinkUrl);

      // Redirect to the custom protocol
      window.location.href = deepLinkUrl;

      // Show a message in case the redirect doesn't work immediately
      setTimeout(() => {
        setStatus("error");
        setErrorMessage(
          "If the app didn't open automatically, please make sure Command X is installed and try again."
        );
      }, 3000);
    } catch (err) {
      console.error("[DesktopCallback] Error:", err);
      setStatus("error");
      setErrorMessage("An unexpected error occurred. Please try again.");
    }
  }, []);

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <div className="text-destructive text-lg font-semibold">
          Unable to complete sign in
        </div>
        <p className="text-muted-foreground max-w-md">{errorMessage}</p>
        <a
          href="/auth"
          className="mt-4 text-primary underline hover:text-primary/80"
        >
          Return to sign in
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground">Opening Command X app...</p>
      <p className="text-sm text-muted-foreground/70">
        You can close this browser tab after the app opens.
      </p>
    </div>
  );
};

export default DesktopCallback;

