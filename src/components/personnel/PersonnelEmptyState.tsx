import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PersonnelEmptyStateProps {
  onAddClick: () => void;
}

export const PersonnelEmptyState = ({ onAddClick }: PersonnelEmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <Users className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No personnel found</h3>
      <p className="text-muted-foreground mb-6 max-w-md">
        Get started by adding your first personnel member. You can track their
        information, certifications, and project assignments.
      </p>
      <Button onClick={onAddClick}>Add Personnel</Button>
    </div>
  );
};
