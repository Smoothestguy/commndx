import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Mail, Phone, AlertCircle } from "lucide-react";
import { ContactCodeDialog } from "./ContactCodeDialog";
import type { ContactType, VerificationContext } from "@/lib/contactVerification";

export type ContactProofState = { proof?: string; skipped?: boolean };
export interface ContactVerificationValue { email: ContactProofState; phone: ContactProofState }

interface Props {
  context: VerificationContext;
  email: string;
  phone: string;
  need: { email: boolean; phone: boolean; emailProven?: boolean; phoneProven?: boolean };
  value: ContactVerificationValue;
  onChange: (v: ContactVerificationValue) => void;
}

/** Every needed contact is either verified or explicitly skipped — never a hard block. */
export const verificationResolved = (need: Props["need"], v: ContactVerificationValue) =>
  (!need.email || !!v.email.proof || !!v.email.skipped) && (!need.phone || !!v.phone.proof || !!v.phone.skipped);

export function ContactVerificationStep({ context, email, phone, need, value, onChange }: Props) {
  const [open, setOpen] = useState<ContactType | null>(null);
  const row = (type: ContactType) => {
    const contact = type === "email" ? email : phone;
    const proven = type === "email" ? need.emailProven : need.phoneProven;
    const required = type === "email" ? need.email : need.phone;
    const st = value[type];
    const Icon = type === "email" ? Mail : Phone;
    if (!contact) return null;
    return (
      <div key={type} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium truncate min-w-0 flex-1">{contact}</span>
        {proven || st.proof ? (
          <span className="inline-flex items-center gap-1 text-sm text-primary whitespace-nowrap"><CheckCircle2 className="h-4 w-4" /> Verified / Verificado</span>
        ) : st.skipped ? (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground whitespace-nowrap"><AlertCircle className="h-4 w-4" /> Not verified / Sin verificar</span>
        ) : required ? (
          <Button type="button" size="sm" onClick={() => setOpen(type)}>Send code / Enviar código</Button>
        ) : null}
        {st.skipped && <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(type)}>Try again / Reintentar</Button>}
      </div>
    );
  };
  return (
    <div className="space-y-2" data-testid="contact-verification-step">
      <p className="text-sm text-muted-foreground">Confirm your contact info with a 6-digit code. / Confirma tus datos de contacto con un código de 6 dígitos.</p>
      {row("email")}
      {row("phone")}
      {open && (
        <ContactCodeDialog
          open={!!open} onOpenChange={(o) => !o && setOpen(null)} context={context} contactType={open}
          contact={open === "email" ? email : phone}
          onVerified={(proof) => onChange({ ...value, [open]: { proof } })}
          onSkip={() => onChange({ ...value, [open]: { skipped: true } })}
        />
      )}
    </div>
  );
}
