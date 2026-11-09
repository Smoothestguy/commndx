import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { fmtMoney0 } from '@/lib/assetBilling';
import { assetCostBreakdown, insuranceExpiringSoon, marginPct, type AssetCostInputs } from '@/lib/assetCost';
import { formatLocalDate } from '@/lib/dateUtils';

export const COST_NUMBER_KEYS = ['insurance_annual_cost', 'registration_annual_cost', 'maintenance_annual_cost', 'financing_annual_cost', 'other_annual_cost', 'useful_life_years', 'salvage_value', 'daily_cost_override'] as const;
type NumKey = typeof COST_NUMBER_KEYS[number];
export type AssetCostDraft = Record<NumKey | 'insurance_carrier' | 'insurance_policy_number' | 'insurance_expires_on' | 'other_annual_cost_note', string> & { daily_cost_overridden: boolean };

export function costDraftFrom(a: Partial<AssetCostInputs & Record<string, unknown>> | null | undefined): AssetCostDraft {
  const s = (v: unknown, d = '') => (v == null ? d : String(v));
  return {
    insurance_carrier: s(a?.insurance_carrier), insurance_policy_number: s(a?.insurance_policy_number), insurance_expires_on: s(a?.insurance_expires_on),
    insurance_annual_cost: s(a?.insurance_annual_cost), registration_annual_cost: s(a?.registration_annual_cost), maintenance_annual_cost: s(a?.maintenance_annual_cost),
    financing_annual_cost: s(a?.financing_annual_cost), other_annual_cost: s(a?.other_annual_cost), other_annual_cost_note: s(a?.other_annual_cost_note),
    useful_life_years: s(a?.useful_life_years, '5'), salvage_value: s(a?.salvage_value, '0'), daily_cost_override: s(a?.daily_cost_override),
    daily_cost_overridden: !!a?.daily_cost_overridden,
  };
}
const n = (v: string) => (v.trim() === '' ? null : Number(v));
export const costDraftValid = (d: AssetCostDraft) =>
  COST_NUMBER_KEYS.every(k => d[k].trim() === '' || (Number.isFinite(Number(d[k])) && Number(d[k]) >= 0)) && (d.useful_life_years.trim() === '' || Number(d.useful_life_years) > 0)
  && (!d.daily_cost_overridden || n(d.daily_cost_override) != null);
export function costDraftToRow(d: AssetCostDraft) {
  const t = (v: string) => v.trim() || null;
  return {
    insurance_carrier: t(d.insurance_carrier), insurance_policy_number: t(d.insurance_policy_number), insurance_expires_on: t(d.insurance_expires_on),
    insurance_annual_cost: n(d.insurance_annual_cost), registration_annual_cost: n(d.registration_annual_cost), maintenance_annual_cost: n(d.maintenance_annual_cost),
    financing_annual_cost: n(d.financing_annual_cost), other_annual_cost: n(d.other_annual_cost), other_annual_cost_note: t(d.other_annual_cost_note),
    useful_life_years: n(d.useful_life_years) ?? 5, salvage_value: n(d.salvage_value) ?? 0,
    daily_cost_override: n(d.daily_cost_override), daily_cost_overridden: d.daily_cost_overridden,
  };
}

const money2 = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Transparent math panel; shared by edit dialog (live draft) and read views. */
export function AssetCostMath({ inputs }: { inputs: AssetCostInputs }) {
  const b = assetCostBreakdown(inputs);
  const year = new Date().getFullYear();
  const row = (label: string, v: string, strong = false) => <div className={cn('flex justify-between gap-2', strong && 'font-semibold border-t pt-1')}><span className="text-muted-foreground">{label}</span><span className="tabular-nums">{v}</span></div>;
  return <div className="rounded-md border bg-muted/30 p-2.5 text-xs space-y-0.5" aria-label="Allocated cost math">
    {b.kind === 'owned' ? <>
      {row('Depreciation (purchase − salvage) / life', money2(b.depreciation))}
      {row('Insurance', money2(b.insurance))}{row('Registration / plates', money2(b.registration))}{row('Maintenance', money2(b.maintenance))}
      {row('Financing / interest', money2(b.financing))}{row('Other', money2(b.other))}
      {row('Annual total', money2(b.annualTotal), true)}
      {row(`Working days ${year}`, String(b.workingDays))}{row('Idle uplift', `× ${b.uplift.toFixed(2)}`)}
      {row('Computed cost/day', b.computed == null ? '—' : money2(b.computed))}
    </> : <>
      {row(`Rental ${inputs.rental_period ?? 'day'} rate`, inputs.rental_rate == null ? '—' : money2(Number(inputs.rental_rate)))}
      {inputs.rental_period === 'month' && row(`× 12 ÷ ${b.workingDays} working days`, '')}
      {inputs.rental_period === 'week' && row('÷ 5 working days', '')}
      {row('Computed cost/day (no uplift)', b.computed == null ? '—' : money2(b.computed))}
    </>}
    {row(`Allocated cost/day${b.overridden ? ' (overridden)' : ''}`, b.perDay == null ? '—' : money2(b.perDay), true)}
  </div>;
}

export function AssetCostFields({ value, onChange, base }: { value: AssetCostDraft; onChange: (d: AssetCostDraft) => void; base: AssetCostInputs }) {
  const field = (k: keyof AssetCostDraft, label: string, type: 'number' | 'text' | 'date' = 'number') => <div className="space-y-1">
    <Label htmlFor={`cost-${k}`} className="text-xs">{label}</Label>
    <Input id={`cost-${k}`} className="h-9" type={type} min={type === 'number' ? 0 : undefined} step={type === 'number' ? '0.01' : undefined} inputMode={type === 'number' ? 'decimal' : undefined}
      value={value[k] as string} onChange={e => onChange({ ...value, [k]: e.target.value })} />
  </div>;
  const owned = base.ownership !== 'rented';
  return <div className="space-y-3 rounded-md border p-3">
    <p className="text-sm font-medium">Our cost accounting <span className="text-xs font-normal text-muted-foreground">(managers only)</span></p>
    {owned && <>
      <div className="grid grid-cols-2 gap-2">{field('insurance_carrier', 'Insurance carrier', 'text')}{field('insurance_policy_number', 'Policy #', 'text')}{field('insurance_expires_on', 'Insurance expires', 'date')}{field('insurance_annual_cost', 'Insurance ($/yr)')}</div>
      <div className="grid grid-cols-2 gap-2">{field('registration_annual_cost', 'Registration / plates ($/yr)')}{field('maintenance_annual_cost', 'Maintenance est. ($/yr)')}{field('financing_annual_cost', 'Financing / interest ($/yr)')}{field('other_annual_cost', 'Other ($/yr)')}</div>
      {field('other_annual_cost_note', 'Other cost note', 'text')}
      <div className="grid grid-cols-2 gap-2">{field('useful_life_years', 'Useful life (years)')}{field('salvage_value', 'Salvage value ($)')}</div>
    </>}
    {!costDraftValid(value) && <p className="text-xs text-destructive">Costs must be nonnegative; life must be above 0; an override needs a value.</p>}
    <AssetCostMath inputs={{ ...base, ...costDraftToRow(value) }} />
    <div className="flex items-end gap-3">
      <div className="flex items-center gap-2 pb-2"><Switch id="cost-override" checked={value.daily_cost_overridden} onCheckedChange={c => onChange({ ...value, daily_cost_overridden: c })} /><Label htmlFor="cost-override" className="text-xs">Override cost/day</Label></div>
      {value.daily_cost_overridden && <div className="flex-1">{field('daily_cost_override', 'Override ($/day)')}</div>}
    </div>
  </div>;
}

/** "Our cost $90/day · 40%" — callers must gate to admin/manager. */
export function AssetCostBadge({ asset, billRate, className }: { asset: AssetCostInputs | null | undefined; billRate?: number | null; className?: string }) {
  if (!asset) return null;
  const cost = assetCostBreakdown(asset).perDay;
  if (cost == null) return null;
  const m = marginPct(billRate, cost);
  return <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', m != null && m < 0 ? 'border-destructive/50 text-destructive' : m != null && m < 15 ? 'border-warning/50 text-warning' : 'text-muted-foreground', className)}>
    Our cost {fmtMoney0(cost)}/day{m != null ? ` · ${m}% margin` : ''}
  </Badge>;
}

export function InsuranceBadge({ asset }: { asset: AssetCostInputs | null | undefined }) {
  const today = formatLocalDate(new Date());
  if (!asset?.insurance_expires_on || !insuranceExpiringSoon(asset.insurance_expires_on, today)) return null;
  const expired = asset.insurance_expires_on < today;
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-warning/50 text-warning">{expired ? 'Insurance expired' : 'Insurance expires'} {asset.insurance_expires_on.slice(5).replace('-', '/')}</Badge>;
}
