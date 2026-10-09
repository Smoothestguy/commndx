import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ForceDarkTheme } from "@/components/ForceDarkTheme";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

type State = "loading" | "invalid" | "ready" | "uploading" | "done";

export default function PhotoRequest() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>("loading");
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      if (!token) return setState("invalid");
      const { data, error } = await (supabase as any).rpc("get_photo_request_info", { _token: token });
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row?.first_name) return setState("invalid");
      setFirstName(row.first_name);
      setState("ready");
    })();
  }, [token]);

  const onFile = async (file?: File) => {
    if (!file || !token) return;
    if (!file.type.startsWith("image/")) return setError("Please choose an image. / Elige una imagen.");
    if (file.size > 15 * 1024 * 1024) return setError("Image too large (max 15MB).");
    setError(null);
    setState("uploading");
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `profile-photos/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("application-files").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("application-files").getPublicUrl(path);
      const { data: ok, error: rpcErr } = await (supabase as any).rpc("set_photo_by_token", { _token: token, _photo_url: pub.publicUrl });
      if (rpcErr || !ok) throw rpcErr ?? new Error("Link expired");
      setState("done");
    } catch (e) {
      console.error(e);
      setError("Upload failed — please try again. / Error al subir, inténtalo de nuevo.");
      setState("ready");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <ForceDarkTheme />
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center space-y-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Fairfield Response Group</p>
          {state === "loading" && <Loader2 className="h-8 w-8 animate-spin mx-auto" />}
          {state === "invalid" && (
            <>
              <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
              <h1 className="text-xl font-semibold">This link has expired</h1>
              <p className="text-sm text-muted-foreground">Please contact FRG for a new link.</p>
              <p className="text-sm text-muted-foreground">Este enlace ha expirado. Contacta a FRG para uno nuevo.</p>
            </>
          )}
          {(state === "ready" || state === "uploading") && (
            <>
              <h1 className="text-xl font-semibold">Hi {firstName}! Add a photo for your FRG badge</h1>
              <p className="text-sm text-muted-foreground">Sube una foto para tu credencial FRG</p>
              <p className="text-xs text-muted-foreground">Face the camera, good light, no sunglasses. / Mira a la cámara, buena luz, sin lentes de sol.</p>
              <input ref={inputRef} type="file" accept="image/*" capture="user" className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])} />
              <Button size="lg" className="w-full h-14" disabled={state === "uploading"} onClick={() => inputRef.current?.click()}>
                {state === "uploading" ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Camera className="h-5 w-5 mr-2" />}
                {state === "uploading" ? "Uploading… / Subiendo…" : "Take or choose photo / Tomar foto"}
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </>
          )}
          {state === "done" && (
            <>
              <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
              <h1 className="text-xl font-semibold">Thanks, {firstName}! Photo received.</h1>
              <p className="text-sm text-muted-foreground">¡Gracias! Recibimos tu foto.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
