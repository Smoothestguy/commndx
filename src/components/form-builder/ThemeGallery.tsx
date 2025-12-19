import { cn } from "@/lib/utils";
import { FormTheme } from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { PRESET_THEMES, PresetTheme } from "./PresetThemes";
import { Check } from "lucide-react";

interface ThemeGalleryProps {
  currentTheme: FormTheme;
  onSelectTheme: (theme: FormTheme) => void;
}

function getActiveThemeId(currentTheme: FormTheme): string | null {
  // Try to find a matching preset theme
  for (const preset of PRESET_THEMES) {
    if (
      preset.theme.backgroundGradient === currentTheme.backgroundGradient &&
      preset.theme.buttonColor === currentTheme.buttonColor &&
      preset.theme.fontFamily === currentTheme.fontFamily
    ) {
      return preset.id;
    }
  }
  return null;
}

export function ThemeGallery({ currentTheme, onSelectTheme }: ThemeGalleryProps) {
  const activeThemeId = getActiveThemeId(currentTheme);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Pre-made Themes</h3>
        <span className="text-xs text-muted-foreground">{PRESET_THEMES.length} themes</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {PRESET_THEMES.map((preset) => (
          <ThemeThumbnail
            key={preset.id}
            preset={preset}
            isActive={activeThemeId === preset.id}
            onClick={() => onSelectTheme(preset.theme)}
          />
        ))}
      </div>
    </div>
  );
}

interface ThemeThumbnailProps {
  preset: PresetTheme;
  isActive: boolean;
  onClick: () => void;
}

function ThemeThumbnail({ preset, isActive, onClick }: ThemeThumbnailProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative group rounded-lg overflow-hidden border-2 transition-all duration-200",
        "hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        isActive ? "border-primary ring-2 ring-primary ring-offset-2" : "border-border hover:border-primary/50"
      )}
    >
      {/* Theme Preview */}
      <div
        className="aspect-[4/3] relative"
        style={{ background: preset.thumbnail }}
      >
        {/* Mini form preview overlay */}
        <div className="absolute inset-0 flex items-center justify-center p-2">
          <div className="w-[85%] h-[75%] bg-background/90 backdrop-blur-sm rounded shadow-sm flex flex-col items-center justify-center gap-1 p-1">
            <div className="w-full h-1.5 bg-muted rounded-sm" />
            <div className="w-3/4 h-1.5 bg-muted rounded-sm" />
            <div 
              className="w-1/2 h-2 rounded-sm mt-0.5"
              style={{ backgroundColor: preset.theme.buttonColor || "#0f172a" }}
            />
          </div>
        </div>
        
        {/* Active indicator */}
        {isActive && (
          <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
            <Check className="h-3 w-3" />
          </div>
        )}
      </div>
      
      {/* Theme name */}
      <div className="bg-background/95 backdrop-blur-sm py-1.5 px-2 text-center">
        <span className="text-xs font-medium truncate block">{preset.name}</span>
      </div>
    </button>
  );
}
