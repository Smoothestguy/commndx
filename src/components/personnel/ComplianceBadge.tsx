import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { checkPersonnelCompliance, PersonnelComplianceData } from "@/utils/personnelCompliance";

interface ComplianceBadgeProps {
  personnel: PersonnelComplianceData | null | undefined;
  compact?: boolean;
}

export function ComplianceBadge({ personnel, compact = false }: ComplianceBadgeProps) {
  const compliance = checkPersonnelCompliance(personnel);

  if (!compliance.isOutOfCompliance) {
    return null;
  }

  const badge = (
    <Badge
      variant="destructive"
      className={`gap-1 bg-destructive hover:bg-destructive/90 animate-pulse ${
        compact ? 'h-5 px-1.5 text-[10px]' : ''
      }`}
    >
      <AlertTriangle className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {!compact && '!'}
    </Badge>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="font-medium mb-1">
            {compliance.severity === 'critical' ? 'Critical Compliance Issues' : 'Compliance Warnings'}
          </p>
          <ul className="text-xs space-y-0.5">
            {compliance.issues.map((issue, idx) => (
              <li key={idx}>• {issue}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
