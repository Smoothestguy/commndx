import { Mail } from "lucide-react";

export function InvitationEmptyState() {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
        <Mail className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No Pending Invitations</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        When you invite new users, they'll appear here until they accept their invitation.
      </p>
    </div>
  );
}
