import { Button } from "@/components/ui/button";
import { 
  Bug, 
  FileSpreadsheet, 
  Link, 
  MapPin, 
  Wand2,
  Database,
  Shield,
  FileCode
} from "lucide-react";

interface QuickCommandsProps {
  onCommand: (command: string, goal: string) => void;
  disabled?: boolean;
}

const commands = [
  {
    id: "fix-submit",
    label: "Fix Submit Failing",
    icon: Bug,
    goal: "Debug and fix a form submission that's failing. Look for validation issues, RLS policy problems, or handler errors.",
  },
  {
    id: "flatten-csv",
    label: "Flatten CSV Export",
    icon: FileSpreadsheet,
    goal: "Modify CSV export to expand JSON fields (like answers) into separate columns instead of a single JSON column.",
  },
  {
    id: "add-edit-link",
    label: "Add Edit Link Flow",
    icon: Link,
    goal: "Implement a token-based edit link flow that allows users to edit their submission via a unique URL.",
  },
  {
    id: "add-geocoding",
    label: "Add Geocoding",
    icon: MapPin,
    goal: "Add geocoding functionality to convert addresses to lat/lng coordinates, including a backfill job for existing records.",
  },
  {
    id: "fix-rls",
    label: "Fix RLS Policy",
    icon: Shield,
    goal: "Debug and fix Row Level Security policy issues preventing data access or causing permission errors.",
  },
  {
    id: "add-crud",
    label: "Add CRUD Operations",
    icon: Database,
    goal: "Implement full CRUD (Create, Read, Update, Delete) operations for a database table with proper hooks.",
  },
  {
    id: "refactor-component",
    label: "Refactor Component",
    icon: FileCode,
    goal: "Refactor a component to be more maintainable, extract hooks, split into smaller components.",
  },
  {
    id: "custom",
    label: "Custom Task",
    icon: Wand2,
    goal: "",
  },
];

export function QuickCommands({ onCommand, disabled }: QuickCommandsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {commands.map((cmd) => {
        const Icon = cmd.icon;
        return (
          <Button
            key={cmd.id}
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onCommand(cmd.id, cmd.goal)}
            className="gap-2 text-xs"
          >
            <Icon className="h-3 w-3" />
            {cmd.label}
          </Button>
        );
      })}
    </div>
  );
}
