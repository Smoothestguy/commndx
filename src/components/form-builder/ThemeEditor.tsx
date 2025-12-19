import { useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { FormTheme } from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ThemeGallery } from "./ThemeGallery";
import { Separator } from "@/components/ui/separator";

interface ThemeEditorProps {
  theme: FormTheme;
  onUpdate: (theme: FormTheme) => void;
}

const FONT_OPTIONS = [
  { value: "inherit", label: "System Default" },
  { value: "'Inter', sans-serif", label: "Inter" },
  { value: "'Roboto', sans-serif", label: "Roboto" },
  { value: "'Open Sans', sans-serif", label: "Open Sans" },
  { value: "'Lato', sans-serif", label: "Lato" },
  { value: "'Poppins', sans-serif", label: "Poppins" },
  { value: "'Montserrat', sans-serif", label: "Montserrat" },
  { value: "'Source Sans Pro', sans-serif", label: "Source Sans Pro" },
];

const PRESET_GRADIENTS = [
  { value: "none", label: "None" },
  { value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", label: "Purple Gradient" },
  { value: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", label: "Pink Gradient" },
  { value: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", label: "Blue Gradient" },
  { value: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)", label: "Green Gradient" },
  { value: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", label: "Sunset Gradient" },
  { value: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)", label: "Soft Gradient" },
];

export function ThemeEditor({ theme, onUpdate }: ThemeEditorProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `form-bg-${Date.now()}.${fileExt}`;
      const filePath = `form-backgrounds/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("form-uploads")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("form-uploads")
        .getPublicUrl(filePath);

      onUpdate({ ...theme, backgroundImage: publicUrl, backgroundGradient: undefined });
      toast.success("Background image uploaded");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const removeBackgroundImage = () => {
    onUpdate({ ...theme, backgroundImage: undefined });
  };

  return (
    <div className="space-y-6">
      {/* Theme Gallery */}
      <ThemeGallery currentTheme={theme} onSelectTheme={onUpdate} />
      
      <Separator />
      
      <div className="text-sm font-medium">Customize Theme</div>

      {/* Layout Style */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Layout Style</Label>
        <RadioGroup
          value={theme.layout || "card"}
          onValueChange={(value: "card" | "fullwidth") => 
            onUpdate({ ...theme, layout: value })
          }
          className="grid grid-cols-2 gap-3"
        >
          <div>
            <RadioGroupItem value="card" id="layout-card" className="peer sr-only" />
            <Label
              htmlFor="layout-card"
              className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
            >
              <div className="w-full h-12 bg-muted rounded border flex items-center justify-center">
                <div className="w-3/4 h-8 bg-background rounded shadow-sm" />
              </div>
              <span className="mt-2 text-xs">Card</span>
            </Label>
          </div>
          <div>
            <RadioGroupItem value="fullwidth" id="layout-fullwidth" className="peer sr-only" />
            <Label
              htmlFor="layout-fullwidth"
              className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
            >
              <div className="w-full h-12 bg-muted rounded border flex items-center justify-center">
                <div className="w-full h-10 bg-background" />
              </div>
              <span className="mt-2 text-xs">Full Width</span>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Card Transparency - only show for card layout */}
      {(theme.layout || "card") === "card" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Card Transparency</Label>
            <span className="text-sm text-muted-foreground">
              {100 - (theme.cardOpacity ?? 90)}%
            </span>
          </div>
          <Slider
            value={[100 - (theme.cardOpacity ?? 90)]}
            onValueChange={([value]) => onUpdate({ ...theme, cardOpacity: 100 - value })}
            min={0}
            max={100}
            step={5}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Adjust how much the background shows through the card
          </p>
        </div>
      )}

      {/* Background Color */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Background Color</Label>
        <div className="flex gap-2">
          <div className="relative">
            <Input
              type="color"
              value={theme.backgroundColor || "#f8fafc"}
              onChange={(e) => onUpdate({ ...theme, backgroundColor: e.target.value })}
              className="w-12 h-9 p-1 cursor-pointer"
            />
          </div>
          <Input
            value={theme.backgroundColor || "#f8fafc"}
            onChange={(e) => onUpdate({ ...theme, backgroundColor: e.target.value })}
            placeholder="#f8fafc"
            className="flex-1 h-9"
          />
        </div>
      </div>

      {/* Background Gradient */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Background Gradient</Label>
        <Select
          value={theme.backgroundGradient || "none"}
          onValueChange={(value) =>
            onUpdate({
              ...theme,
              backgroundGradient: value === "none" ? undefined : value,
              backgroundImage: value !== "none" ? undefined : theme.backgroundImage,
            })
          }
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select a gradient" />
          </SelectTrigger>
          <SelectContent>
            {PRESET_GRADIENTS.map((gradient) => (
              <SelectItem key={gradient.label} value={gradient.value}>
                <div className="flex items-center gap-2">
                  {gradient.value !== "none" && (
                    <div
                      className="w-4 h-4 rounded"
                      style={{ background: gradient.value }}
                    />
                  )}
                  {gradient.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Background Image */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Background Image</Label>
        {theme.backgroundImage ? (
          <div className="relative">
            <img
              src={theme.backgroundImage}
              alt="Background"
              className="w-full h-24 object-cover rounded-lg"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6"
              onClick={removeBackgroundImage}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={isUploading}
              className="hidden"
              id="bg-image-upload"
            />
            <Label
              htmlFor="bg-image-upload"
              className="flex items-center justify-center gap-2 h-24 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
            >
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {isUploading ? "Uploading..." : "Upload background image"}
              </span>
            </Label>
          </div>
        )}
      </div>

      {/* Font Family */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Font Family</Label>
        <Select
          value={theme.fontFamily || "inherit"}
          onValueChange={(value) => onUpdate({ ...theme, fontFamily: value })}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map((font) => (
              <SelectItem key={font.value} value={font.value}>
                <span style={{ fontFamily: font.value }}>{font.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Primary/Button Color */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Button Color</Label>
        <div className="flex gap-2">
          <div className="relative">
            <Input
              type="color"
              value={theme.buttonColor || "#0f172a"}
              onChange={(e) => onUpdate({ ...theme, buttonColor: e.target.value })}
              className="w-12 h-9 p-1 cursor-pointer"
            />
          </div>
          <Input
            value={theme.buttonColor || "#0f172a"}
            onChange={(e) => onUpdate({ ...theme, buttonColor: e.target.value })}
            placeholder="#0f172a"
            className="flex-1 h-9"
          />
        </div>
      </div>

      {/* Button Text */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Button Text</Label>
          <Input
            value={theme.buttonText || "Submit"}
            onChange={(e) => onUpdate({ ...theme, buttonText: e.target.value })}
            placeholder="Submit"
            className="h-9"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Button Text Color</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={theme.buttonTextColor || "#ffffff"}
              onChange={(e) => onUpdate({ ...theme, buttonTextColor: e.target.value })}
              className="w-12 h-9 p-1 cursor-pointer"
            />
            <Input
              value={theme.buttonTextColor || "#ffffff"}
              onChange={(e) => onUpdate({ ...theme, buttonTextColor: e.target.value })}
              className="flex-1 h-9"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
