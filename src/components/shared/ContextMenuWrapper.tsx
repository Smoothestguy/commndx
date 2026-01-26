import { Fragment, ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { LucideIcon } from "lucide-react";

export interface ContextMenuItemConfig {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: "default" | "destructive";
  separator?: boolean;
  disabled?: boolean;
}

interface ContextMenuWrapperProps {
  children: ReactNode;
  items: ContextMenuItemConfig[];
}

export function ContextMenuWrapper({ children, items }: ContextMenuWrapperProps) {
  if (items.length === 0) {
    return <>{children}</>;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {items.map((item, index) => (
          <Fragment key={index}>
            {item.separator && <ContextMenuSeparator />}
            <ContextMenuItem
              onClick={(e) => {
                e.stopPropagation();
                item.onClick();
              }}
              disabled={item.disabled}
              className={item.variant === "destructive" ? "text-destructive focus:text-destructive" : ""}
            >
              {item.icon && <item.icon className="mr-2 h-4 w-4" />}
              {item.label}
            </ContextMenuItem>
          </Fragment>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}
