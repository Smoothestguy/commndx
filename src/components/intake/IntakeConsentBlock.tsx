import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { INTAKE_TEXT, IntakeLang, IntakeConsentState } from "@/lib/intakeConsents";

interface Props {
  lang: IntakeLang;
  value: IntakeConsentState;
  onChange: (v: IntakeConsentState) => void;
  errors?: Partial<Record<keyof IntakeConsentState, string | null>>;
  privacyUrl?: string;
  termsUrl?: string;
}

export function IntakeConsentBlock({ lang, value, onChange, errors, privacyUrl, termsUrl }: Props) {
  const t = INTAKE_TEXT[lang];
  const row = (key: keyof IntakeConsentState, text: string) => (
    <div className="flex items-start gap-3">
      <Checkbox
        id={`intake-consent-${key}`}
        checked={value[key]}
        onCheckedChange={(c) => onChange({ ...value, [key]: c === true })}
        className="mt-0.5"
        aria-label={text}
      />
      <div className="space-y-1">
        <Label htmlFor={`intake-consent-${key}`} className="text-sm leading-relaxed cursor-pointer">
          {text} <span className="text-destructive">*</span>
        </Label>
        {errors?.[key] && <p className="text-sm font-medium text-destructive">{errors[key]}</p>}
      </div>
    </div>
  );
  return (
    <section className="space-y-3 rounded-lg border p-4" data-testid="intake-consents">
      <div>
        <h3 className="text-sm font-semibold">{t.consentsTitle}</h3>
        <p className="text-xs text-muted-foreground">{t.consentsHelp}</p>
      </div>
      {row("sms", t.sms)}
      {row("photo", t.photo)}
      {(privacyUrl || termsUrl) && (
        <div className="flex gap-3 text-xs">
          {privacyUrl && <a href={privacyUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Privacy Policy</a>}
          {termsUrl && <a href={termsUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Terms of Service</a>}
        </div>
      )}
    </section>
  );
}
