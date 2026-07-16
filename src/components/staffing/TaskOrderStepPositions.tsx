import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import {
  ProjectRateBracket,
} from "@/integrations/supabase/hooks/useProjectRateBrackets";
import type { TaskOrderPositionInput } from "@/integrations/supabase/hooks/useStaffingApplications";

export interface PositionDraft extends TaskOrderPositionInput {
  _key: string;
  _isNewBracket?: boolean;
  _newBracketName?: string;
}

export const NEW_BRACKET_VALUE = "__new__";

export function makeNewPositionDraft(): PositionDraft {
  return {
    _key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    rate_bracket_id: null,
    position_label: "",
    headcount: 1,
    advertised_pay_rate: null,
    show_pay_publicly: true,
    notes: null,
  };
}

interface Props {
  positions: PositionDraft[];
  onChange: (next: PositionDraft[]) => void;
  rateBrackets: ProjectRateBracket[] | undefined;
  projectSelected: boolean;
  showErrors?: boolean;
}

export function TaskOrderStepPositions({
  positions,
  onChange,
  rateBrackets,
  projectSelected,
  showErrors = false,
}: Props) {
  const totalHeadcount = positions.reduce(
    (s, p) => s + (Number(p.headcount) || 0),
    0
  );

  const update = (key: string, patch: Partial<PositionDraft>) => {
    onChange(positions.map((p) => (p._key === key ? { ...p, ...patch } : p)));
  };
  const remove = (key: string) => onChange(positions.filter((p) => p._key !== key));
  const add = () => onChange([...positions, makeNewPositionDraft()]);

  const handleBracketSelect = (key: string, val: string) => {
    if (val === NEW_BRACKET_VALUE) {
      onChange(
        positions.map((p) =>
          p._key === key
            ? {
                ...p,
                rate_bracket_id: null,
                _isNewBracket: true,
                _newBracketName: "",
                position_label: "",
              }
            : p
        )
      );
      return;
    }
    const bracket = rateBrackets?.find((b) => b.id === val);
    onChange(
      positions.map((p) => {
        if (p._key !== key) return p;
        const nextPay =
          p.advertised_pay_rate == null && bracket?.default_pay_rate != null
            ? bracket.default_pay_rate
            : p.advertised_pay_rate;
        return {
          ...p,
          rate_bracket_id: val,
          _isNewBracket: false,
          _newBracketName: undefined,
          position_label: bracket?.name || p.position_label,
          advertised_pay_rate: nextPay ?? null,
        };
      })
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Positions</p>
          <p className="text-xs text-muted-foreground">
            Add each role needed. Total headcount:{" "}
            <span className="font-semibold">{totalHeadcount}</span>
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={!projectSelected}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Position
        </Button>
      </div>

      {!projectSelected && (
        <p className="text-xs text-muted-foreground">
          Select a project first before adding positions.
        </p>
      )}

      {positions.length === 0 && projectSelected && (
        <div className="border border-dashed rounded-md p-4 text-center text-sm text-muted-foreground">
          No positions yet — positions are optional but recommended.
        </div>
      )}

      <div className="space-y-3">
        {positions.map((p) => {
          const currentBracket = rateBrackets?.find(
            (b) => b.id === p.rate_bracket_id
          );
          return (
            <div key={p._key} className="rounded-md border p-3 space-y-3 bg-muted/20">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-5">
                  <Label className="text-xs">Position</Label>
                  <Select
                    value={
                      p._isNewBracket ? NEW_BRACKET_VALUE : p.rate_bracket_id || ""
                    }
                    onValueChange={(v) => handleBracketSelect(p._key, v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose position…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(rateBrackets || []).map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={NEW_BRACKET_VALUE}>+ New position…</SelectItem>
                    </SelectContent>
                  </Select>
                  {p._isNewBracket && (
                    <Input
                      className="mt-2"
                      placeholder="New position name (required)"
                      value={p._newBracketName || ""}
                      onChange={(e) =>
                        update(p._key, {
                          _newBracketName: e.target.value,
                          position_label: e.target.value,
                        })
                      }
                    />
                  )}
                  {currentBracket && currentBracket.default_pay_rate == null && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      No default pay saved for this bracket — the rate you enter will be
                      saved as its default.
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Headcount</Label>
                  <Input
                    type="number"
                    min={1}
                    value={p.headcount}
                    onChange={(e) =>
                      update(p._key, {
                        headcount: parseInt(e.target.value, 10) || 1,
                      })
                    }
                  />
                </div>
                <div className="sm:col-span-3">
                  <Label className="text-xs">Pay Rate ($/hr)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={
                      p.advertised_pay_rate == null
                        ? ""
                        : String(p.advertised_pay_rate)
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      update(p._key, {
                        advertised_pay_rate: v === "" ? null : parseFloat(v),
                      });
                    }}
                    placeholder="—"
                    aria-invalid={
                      showErrors && p.show_pay_publicly && p.advertised_pay_rate == null
                    }
                    className={
                      showErrors && p.show_pay_publicly && p.advertised_pay_rate == null
                        ? "border-destructive"
                        : ""
                    }
                  />
                  {showErrors && p.show_pay_publicly && p.advertised_pay_rate == null ? (
                    <p className="text-[11px] text-destructive mt-1">
                      Pay is required when "Show Pay" is on.
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Postings that show pay get significantly more applicants.
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2 flex flex-col justify-between">
                  <Label className="text-xs">Show Pay</Label>
                  <div className="flex items-center justify-between h-10">
                    <Switch
                      checked={p.show_pay_publicly}
                      onCheckedChange={(v) => update(p._key, { show_pay_publicly: v })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => remove(p._key)}
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Input
                  value={p.notes || ""}
                  onChange={(e) => update(p._key, { notes: e.target.value })}
                  placeholder="Optional notes visible to admin only"
                />
              </div>
            </div>
          );
        })}
      </div>

      {positions.length > 0 && (
        <Badge variant="secondary" className="text-xs">
          Task order headcount will be set to {totalHeadcount}
        </Badge>
      )}
    </div>
  );
}
