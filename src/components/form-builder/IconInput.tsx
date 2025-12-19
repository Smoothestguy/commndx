import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Phone, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface IconInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  required?: boolean;
  icon?: "email" | "phone" | "user" | "none";
  helpText?: string;
}

export const IconInput = forwardRef<HTMLInputElement, IconInputProps>(
  ({ label, required, icon = "none", helpText, className, ...props }, ref) => {
    const IconComponent = {
      email: Mail,
      phone: Phone,
      user: User,
      none: null,
    }[icon];

    return (
      <div className="space-y-2">
        {label && (
          <Label className="text-sm font-medium">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        
        <div className="relative flex items-center">
          {IconComponent && (
            <div className="absolute left-0 flex items-center justify-center w-10 h-full bg-muted border border-r-0 rounded-l-md">
              <IconComponent className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <Input
            ref={ref}
            className={cn(
              IconComponent && "pl-12 rounded-l-none",
              className
            )}
            {...props}
          />
        </div>
        
        {helpText && (
          <p className="text-xs text-muted-foreground">{helpText}</p>
        )}
      </div>
    );
  }
);

IconInput.displayName = "IconInput";
