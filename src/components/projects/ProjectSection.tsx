import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ProjectSectionProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function ProjectSection({
  title,
  icon,
  count,
  defaultOpen = false,
  children,
  className,
}: ProjectSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (count === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={cn("mb-4", className)}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-secondary/50 hover:bg-secondary rounded-lg mb-2 transition-colors group">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground group-hover:text-foreground transition-colors">
            {icon}
          </span>
          <span className="font-medium text-sm sm:text-base">{title}</span>
          <Badge variant="secondary" className="text-xs">
            {count}
          </Badge>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="animate-fade-in">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
