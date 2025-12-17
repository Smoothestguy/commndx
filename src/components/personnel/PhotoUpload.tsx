import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PhotoUploadProps {
  currentPhotoUrl?: string;
  onPhotoChange: (url: string) => void;
  onPhotoSaved?: (url: string) => Promise<void>;
  personnelId?: string;
}

export const PhotoUpload = ({
  currentPhotoUrl,
  onPhotoChange,
  onPhotoSaved,
  personnelId,
}: PhotoUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentPhotoUrl || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setUploading(true);

    try {
      // Create preview
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      // Upload to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${personnelId || Date.now()}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from("personnel-photos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("personnel-photos").getPublicUrl(filePath);

      onPhotoChange(publicUrl);
      
      // Auto-save to database if callback provided (for existing personnel)
      if (onPhotoSaved) {
        try {
          await onPhotoSaved(publicUrl);
          toast.success("Photo uploaded and saved");
        } catch (saveError) {
          console.error("Error saving photo to database:", saveError);
          toast.error("Photo uploaded but failed to save - please save the form");
        }
      } else {
        toast.success("Photo uploaded - remember to save the form");
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error("Failed to upload photo");
      setPreviewUrl(currentPhotoUrl || "");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreviewUrl("");
    onPhotoChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-24 w-24">
        <AvatarImage src={previewUrl} />
        <AvatarFallback>
          <Upload className="h-8 w-8 text-muted-foreground" />
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            "Uploading..."
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Photo
            </>
          )}
        </Button>

        {previewUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRemove}
          >
            <X className="mr-2 h-4 w-4" />
            Remove
          </Button>
        )}

        <p className="text-xs text-muted-foreground">
          JPG, PNG or GIF. Max 5MB.
        </p>
      </div>
    </div>
  );
};
