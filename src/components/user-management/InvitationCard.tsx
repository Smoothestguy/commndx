import { Mail, Clock, Calendar, Send, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import { format } from "date-fns";

type AppRole = Database["public"]["Enums"]["app_role"];

interface PendingInvitation {
  id: string;
  email: string;
  role: AppRole;
  created_at: string;
  expires_at: string;
  status: string;
  token: string;
}

interface InvitationCardProps {
  invitation: PendingInvitation;
  onResend: (invitation: PendingInvitation) => Promise<void>;
  onCancel: (invitation: PendingInvitation) => Promise<void>;
  isProcessing: boolean;
  index: number;
}

export function InvitationCard({
  invitation,
  onResend,
  onCancel,
  isProcessing,
  index,
}: InvitationCardProps) {
  const isMobile = useIsMobile();

  const getTimeUntilExpiry = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) return { text: "Expired", color: "text-red-500" };
    if (daysLeft === 0) return { text: "Expires today", color: "text-red-500" };
    if (daysLeft === 1) return { text: "Expires tomorrow", color: "text-yellow-500" };
    if (daysLeft <= 2) return { text: `Expires in ${daysLeft} days`, color: "text-yellow-500" };
    return { text: `Expires in ${daysLeft} days`, color: "text-green-500" };
  };

  const getRoleBadgeVariant = (role: AppRole) => {
    if (role === "admin") return "default";
    if (role === "manager") return "secondary";
    if (role === "accounting") return "secondary";
    return "outline";
  };

  const getStatusBorderColor = () => {
    const expiry = getTimeUntilExpiry(invitation.expires_at);
    if (expiry.color.includes("red")) return "border-l-red-500";
    if (expiry.color.includes("yellow")) return "border-l-yellow-500";
    return "border-l-green-500";
  };

  const expiryInfo = getTimeUntilExpiry(invitation.expires_at);

  return (
    <div
      className={cn(
        "glass rounded-xl border-l-4 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300",
        getStatusBorderColor(),
        isMobile ? "p-4" : "p-6"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="space-y-3 md:space-y-4">
        {/* Email and Role */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Mail className={cn("text-primary flex-shrink-0", isMobile ? "h-4 w-4" : "h-5 w-5")} />
            <span className={cn("font-semibold truncate", isMobile ? "text-sm" : "text-base")}>
              {invitation.email}
            </span>
          </div>
          <Badge variant={getRoleBadgeVariant(invitation.role)} className="capitalize flex-shrink-0 text-xs">
            {invitation.role}
          </Badge>
        </div>

        {/* Expiry Info */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className={cn("h-4 w-4 flex-shrink-0", expiryInfo.color)} />
          <span className={expiryInfo.color}>{expiryInfo.text}</span>
        </div>

        {/* Sent Date */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 flex-shrink-0" />
          <span>Sent {format(new Date(invitation.created_at), "MMM d, yyyy")}</span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 md:gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => onResend(invitation)}
            disabled={isProcessing}
            className="w-full min-h-[44px]"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Resend
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onCancel(invitation)}
            disabled={isProcessing}
            className="w-full min-h-[44px]"
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
