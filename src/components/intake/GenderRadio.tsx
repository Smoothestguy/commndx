import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { INTAKE_TEXT, IntakeLang } from "@/lib/intakeConsents";

export function GenderRadio({ lang, value, onChange, error, required = true }: {
  lang: IntakeLang; value: string | null; onChange: (v: "male" | "female") => void; error?: string | null; required?: boolean;
}) {
  const t = INTAKE_TEXT[lang];
  return (
    <div className="space-y-2">
      <Label>{t.gender}{required && <span className="text-destructive"> *</span>}</Label>
      <RadioGroup value={value ?? ""} onValueChange={(v) => onChange(v as "male" | "female")} className="flex gap-6" aria-label={t.gender}>
        {(["male", "female"] as const).map((g) => (
          <div key={g} className="flex items-center gap-2">
            <RadioGroupItem value={g} id={`gender-${g}`} />
            <Label htmlFor={`gender-${g}`} className="cursor-pointer font-normal">{t[g]}</Label>
          </div>
        ))}
      </RadioGroup>
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
