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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Registrations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-warning" />
            Pending Registrations
            <Badge variant="secondary" className="ml-auto">
              {registrations.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {registrations.map((registration) => (
            <Card
              key={registration.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setSelectedRegistration(registration)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-2">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {registration.first_name} {registration.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {registration.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {registration.documents.length > 0 && (
                      <Badge variant="outline" className="gap-1">
                        <FileText className="h-3 w-3" />
                        {registration.documents.length}
                      </Badge>
                    )}
                    <div className="text-right">
                      <Badge variant="secondary">Pending Review</Badge>
                      <p className="text-xs text-muted-foreground mt-1">
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
