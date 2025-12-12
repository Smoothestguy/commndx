import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PersonnelEmptyStateProps {
  onAddClick: () => void;
}

export const PersonnelEmptyState = ({
  onAddClick,
}: PersonnelEmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-4 sm:p-6 mb-3 sm:mb-4">
        <Users className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground" />
      </div>
      <h3 className="text-base sm:text-lg font-semibold mb-2">
        No personnel found
      </h3>
      <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 max-w-md">
        Get started by adding your first personnel member. Track their
        information, certifications, and assignments.
      </p>
      <Button onClick={onAddClick} className="min-h-[44px] sm:min-h-[40px]">
        Add Personnel
      </Button>
    </div>
  );
};
