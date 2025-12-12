import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePersonnelRegistrations,
  type PersonnelRegistration,
} from "@/integrations/supabase/hooks/usePersonnelRegistrations";
import { RegistrationReviewDialog } from "./RegistrationReviewDialog";
import { Clock, User, FileText, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const PendingRegistrations = () => {
  const { data: registrations, isLoading } =
    usePersonnelRegistrations("pending");
  const [selectedRegistration, setSelectedRegistration] =
    useState<PersonnelRegistration | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            Pending Registrations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 sm:space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 sm:h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!registrations || registrations.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-warning/50 bg-warning/5">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-warning shrink-0" />
            <span className="truncate">Pending Registrations</span>
            <Badge variant="secondary" className="ml-auto shrink-0">
              {registrations.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 sm:space-y-3">
          {registrations.map((registration) => (
            <Card
              key={registration.id}
              className="cursor-pointer hover:bg-accent/50 active:bg-accent/70 transition-colors"
              onClick={() => setSelectedRegistration(registration)}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="rounded-full bg-primary/10 p-1.5 sm:p-2 shrink-0">
                      <User className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate">
                        {registration.first_name} {registration.last_name}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {registration.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 ml-7 sm:ml-0">
                    {registration.documents.length > 0 && (
                      <Badge
                        variant="outline"
                        className="gap-1 text-xs shrink-0"
                      >
                        <FileText className="h-3 w-3" />
                        {registration.documents.length}
                      </Badge>
                    )}
                    <div className="text-right shrink-0">
                      <Badge variant="secondary" className="text-xs">
                        Pending
                      </Badge>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                        {formatDistanceToNow(
                          new Date(registration.created_at),
                          { addSuffix: true }
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <RegistrationReviewDialog
        registration={selectedRegistration}
        open={!!selectedRegistration}
        onOpenChange={(open) => !open && setSelectedRegistration(null)}
      />
    </>
  );
};
