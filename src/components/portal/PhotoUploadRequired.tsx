import { useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PhotoUpload } from "@/components/personnel/PhotoUpload";
import { useUpdatePersonnelPhoto } from "@/integrations/supabase/hooks/usePortal";

interface PhotoUploadRequiredProps {
  personnelId: string;
}

export function PhotoUploadRequired({ personnelId }: PhotoUploadRequiredProps) {
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const updatePhoto = useUpdatePersonnelPhoto();

  const handlePhotoSaved = async (url: string) => {
    await updatePhoto.mutateAsync(url);
    setPhotoUrl(url);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Camera className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Profile Photo Required</CardTitle>
          <CardDescription className="text-base">
            A profile photo is required for identification and badge printing.
            Please upload a clear headshot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <PhotoUpload
            currentPhotoUrl={photoUrl}
            onPhotoChange={setPhotoUrl}
            onPhotoSaved={handlePhotoSaved}
            personnelId={personnelId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
