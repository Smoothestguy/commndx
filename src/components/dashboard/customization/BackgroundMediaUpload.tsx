import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X, Image, Video, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardTheme } from "../widgets/types";
import { PageSelector } from "./PageSelector";

interface BackgroundMediaUploadProps {
  theme: DashboardTheme;
  onChange: (updates: Partial<DashboardTheme>) => void;
}

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif"];
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

export function BackgroundMediaUpload({
  theme,
  onChange,
}: BackgroundMediaUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasBackground = theme.backgroundImage || theme.backgroundVideo;
  const isVideo = !!theme.backgroundVideo;

  const handleFileSelect = async (file: File) => {
    const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type);
    const isVideoFile = ACCEPTED_VIDEO_TYPES.includes(file.type);

    if (!isImage && !isVideoFile) {
      toast.error("Invalid file type. Please upload PNG, JPG, GIF, MP4, or WebM.");
      return;
    }

    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    if (file.size > maxSize) {
      toast.error(
        `File too large. Maximum size is ${isImage ? "10MB" : "50MB"}.`
      );
      return;
    }

    setIsUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to upload files.");
        return;
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("dashboard-backgrounds")
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("dashboard-backgrounds")
        .getPublicUrl(fileName);

      // Clear existing background and set new one
      if (isImage) {
        onChange({
          backgroundImage: publicUrl,
          backgroundVideo: undefined,
          backgroundSize: theme.backgroundSize || "cover",
          backgroundPosition: theme.backgroundPosition || "center",
          backgroundOverlay: theme.backgroundOverlay ?? 20,
        });
      } else {
        onChange({
          backgroundVideo: publicUrl,
          backgroundImage: undefined,
          backgroundPosition: theme.backgroundPosition || "center",
          backgroundOverlay: theme.backgroundOverlay ?? 20,
        });
      }

      toast.success("Background uploaded successfully!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload background. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleRemoveBackground = () => {
    onChange({
      backgroundImage: undefined,
      backgroundVideo: undefined,
      backgroundSize: undefined,
      backgroundPosition: undefined,
      backgroundOverlay: undefined,
    });
    toast.info("Background removed");
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {!hasBackground ? (
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50",
            isUploading && "opacity-50 pointer-events-none"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={[...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES].join(",")}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />
          {isUploading ? (
            <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          )}
          <p className="text-sm text-muted-foreground">
            {isUploading ? "Uploading..." : "Drop image or video here, or click to upload"}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            PNG, JPG, GIF (10MB) • MP4, WebM (50MB)
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Preview */}
          <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
            {isVideo ? (
              <video
                src={theme.backgroundVideo}
                className="w-full h-full object-cover"
                muted
                loop
                autoPlay
                playsInline
              />
            ) : (
              <img
                src={theme.backgroundImage}
                alt="Background preview"
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-background/80 rounded px-2 py-1 text-xs">
              {isVideo ? (
                <Video className="h-3 w-3" />
              ) : (
                <Image className="h-3 w-3" />
              )}
              {isVideo ? "Video" : "Image"}
            </div>
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6"
              onClick={handleRemoveBackground}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          {/* Change Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3 w-3 mr-2" />
            Change Background
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={[...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES].join(",")}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />
        </div>
      )}

      {/* Options (only show when background is set) */}
      {hasBackground && (
        <>
          {/* Size (only for images) */}
          {!isVideo && (
            <div className="space-y-2">
              <Label className="text-xs">Size</Label>
              <Select
                value={theme.backgroundSize || "cover"}
                onValueChange={(value) =>
                  onChange({ backgroundSize: value as DashboardTheme["backgroundSize"] })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cover">Cover</SelectItem>
                  <SelectItem value="contain">Contain</SelectItem>
                  <SelectItem value="auto">Auto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Position */}
          <div className="space-y-2">
            <Label className="text-xs">Position</Label>
            <Select
              value={theme.backgroundPosition || "center"}
              onValueChange={(value) =>
                onChange({ backgroundPosition: value as DashboardTheme["backgroundPosition"] })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="top">Top</SelectItem>
                <SelectItem value="bottom">Bottom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Overlay */}
          <div className="space-y-2">
            <Label className="text-xs">Dark Overlay</Label>
            <Slider
              value={[theme.backgroundOverlay ?? 0]}
              onValueChange={([value]) => onChange({ backgroundOverlay: value })}
              min={0}
              max={80}
              step={5}
            />
            <p className="text-xs text-muted-foreground">
              {theme.backgroundOverlay ?? 0}% — helps text readability
            </p>
          </div>

          {/* Page Selection */}
          <PageSelector
            selectedPages={theme.backgroundPages ?? ["dashboard"]}
            onChange={(pages) => onChange({ backgroundPages: pages })}
          />
        </>
      )}
    </div>
  );
}
