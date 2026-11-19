import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { sendContactCode, verifyContactCode, type ContactType, type VerificationContext } from "@/lib/contactVerification";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: VerificationContext;
  contactType: ContactType;
  contact: string;
  /** Overrides the intro line (e.g. the "already on file" conflict message). */
  intro?: string;
  onVerified: (proofId: string) => void;
  onSkip: () => void;
}

const reasonText: Record<string, string> = {
  wrong_code: "That code isn't right. / Ese código no es correcto.",
  expired: "That code expired. Send a new one. / El código venció. Envía uno nuevo.",
  too_many_attempts: "Too many tries. Send a new code. / Demasiados intentos. Envía un código nuevo.",
  rate_limited: "Too many codes sent. Try again later or tap “I can't get the code”. / Demasiados códigos enviados.",
  unavailable: "We couldn't send a code right now. / No pudimos enviar un código ahora.",
  error: "We couldn't reach the server. / No pudimos conectar con el servidor.",
  invalid: "Send a new code. / Envía un código nuevo.",
};

export function ContactCodeDialog({ open, onOpenChange, context, contactType, contact, intro, onVerified, onSkip }: Props) {
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const sentFor = useRef<string | null>(null);

  const send = async () => {
    setBusy(true); setMessage(null); setCode("");
    const r = await sendContactCode(context, contactType, contact);
    setBusy(false);
    if (r.sent === true) setVerificationId(r.verification_id);
    else { setVerificationId(null); setMessage(reasonText[(r as { reason: string }).reason] ?? reasonText.error); }
  };

  useEffect(() => {
    const key = `${contactType}:${contact}`;
    if (open && sentFor.current !== key) { sentFor.current = key; void send(); }
    if (!open) { sentFor.current = null; setVerificationId(null); setCode(""); setMessage(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contactType, contact]);

  const verify = async () => {
    if (!verificationId || code.length !== 6) return;
    setBusy(true); setMessage(null);
    const r = await verifyContactCode(verificationId, code);
    setBusy(false);
    if (r.verified === true) { onVerified(r.proof_id); onOpenChange(false); return; }
    const reason = (r as { reason: string }).reason;
    setMessage(reasonText[reason] ?? reasonText.error);
    if (reason !== "wrong_code") setVerificationId(null);
  };

  const where = contactType === "email" ? "email / correo" : "phone / teléfono";
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Enter your code / Ingresa tu código</DialogTitle>
          <DialogDescription>
            {intro ?? `We sent a 6-digit code to your ${where}: ${contact}`}
          </DialogDescription>
        </DialogHeader>
        <Input
          inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => { if (e.key === "Enter") void verify(); }}
          className="text-center text-2xl tracking-[0.5em] h-14" aria-label="Verification code"
        />
        {message && <p className="text-sm text-destructive" role="alert">{message}</p>}
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={verify} disabled={busy || !verificationId || code.length !== 6} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm / Confirmar"}
          </Button>
          <Button variant="outline" onClick={send} disabled={busy} className="w-full">Send a new code / Enviar código nuevo</Button>
          <Button variant="ghost" onClick={() => { onSkip(); onOpenChange(false); }} disabled={busy} className="w-full">
            I can't get the code / No recibo el código
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
