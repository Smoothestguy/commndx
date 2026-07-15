import type { PositionDraft } from "@/components/staffing/TaskOrderStepPositions";
import type { TaskOrderPositionInput } from "@/integrations/supabase/hooks/useStaffingApplications";
import type { ProjectRateBracket } from "@/integrations/supabase/hooks/useProjectRateBrackets";

interface Deps {
  projectId: string;
  positions: PositionDraft[];
  rateBrackets: ProjectRateBracket[] | undefined;
  addRateBracket: {
    mutateAsync: (v: { project_id: string; name: string; default_pay_rate: number | null }) => Promise<{ id: string }>;
  };
  updateRateBracket: {
    mutateAsync: (v: { id: string; default_pay_rate: number }) => Promise<unknown>;
  };
}

export async function resolvePositionDrafts({
  projectId,
  positions,
  rateBrackets,
  addRateBracket,
  updateRateBracket,
}: Deps): Promise<TaskOrderPositionInput[]> {
  const resolved: TaskOrderPositionInput[] = [];
  for (const p of positions) {
    let bracketId = p.rate_bracket_id;
    let label = p.position_label.trim();
    const payRate = p.advertised_pay_rate;

    if (p._isNewBracket) {
      const name = (p._newBracketName || label || "").trim();
      if (!name) throw new Error("Please name each new position bracket.");
      const created = await addRateBracket.mutateAsync({
        project_id: projectId,
        name,
        default_pay_rate: payRate ?? null,
      });
      bracketId = created.id;
      label = name;
    } else if (bracketId) {
      const bracket = rateBrackets?.find((b) => b.id === bracketId);
      if (
        bracket &&
        (bracket.default_pay_rate == null || Number(bracket.default_pay_rate) === 0) &&
        payRate != null &&
        !Number.isNaN(payRate)
      ) {
        try {
          await updateRateBracket.mutateAsync({ id: bracket.id, default_pay_rate: payRate });
        } catch (e) {
          console.warn("Could not backfill default_pay_rate", e);
        }
      }
      if (!label) label = bracket?.name || "";
    }

    if (!label) throw new Error("Each position needs a label.");
    if (!p.headcount || p.headcount < 1)
      throw new Error("Each position needs a headcount of 1 or more.");

    resolved.push({
      id: p.id,
      rate_bracket_id: bracketId,
      position_label: label,
      headcount: Math.floor(p.headcount),
      advertised_pay_rate:
        payRate != null && !Number.isNaN(payRate) ? payRate : null,
      show_pay_publicly: p.show_pay_publicly,
      notes: p.notes && p.notes.trim() ? p.notes.trim() : null,
    });
  }
  return resolved;
}
