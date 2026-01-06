import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { DashboardTheme } from "../widgets/types";
import { X } from "lucide-react";
import { BackgroundMediaUpload } from "./BackgroundMediaUpload";

interface DashboardThemeEditorProps {
  theme: DashboardTheme;
  onChange: (theme: DashboardTheme) => void;
  isOpen: boolean;
  onClose: () => void;
}

const FONT_OPTIONS = [
  { value: "default", label: "System Default" },
  { value: "inter", label: "Inter" },
  { value: "roboto", label: "Roboto" },
  { value: "poppins", label: "Poppins" },
  { value: "montserrat", label: "Montserrat" },
];

const PRESET_THEMES: Array<{ name: string; theme: Partial<DashboardTheme> }> = [
  {
    name: "Default",
    theme: {
      backgroundColor: undefined,
      cardBackground: undefined,
      accentColor: undefined,
      fontSize: "medium",
      spacing: "normal",
      borderRadius: "medium",
    },
  },
  {
    name: "Compact",
    theme: {
      fontSize: "small",
      spacing: "compact",
      borderRadius: "small",
    },
  },
  {
    name: "Spacious",
    theme: {
      fontSize: "large",
      spacing: "relaxed",
      borderRadius: "large",
    },
  },
  {
    name: "Dark Accent",
    theme: {
      accentColor: "#6366f1",
      borderRadius: "medium",
    },
  },
  {
    name: "Warm",
    theme: {
      accentColor: "#f59e0b",
      borderRadius: "large",
    },
  },
];

export function DashboardThemeEditor({
  theme,
  onChange,
  isOpen,
  onClose,
}: DashboardThemeEditorProps) {
  if (!isOpen) return null;

  const updateTheme = (updates: Partial<DashboardTheme>) => {
    onChange({ ...theme, ...updates });
  };

  return (
    <div className="fixed right-0 top-14 bottom-0 w-80 bg-background border-l shadow-lg z-[200] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">Theme Settings</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Preset Themes */}
      <div className="p-4 border-b">
        <Label className="text-sm font-medium mb-2 block">Quick Presets</Label>
        <div className="flex flex-wrap gap-2">
          {PRESET_THEMES.map((preset) => (
            <Button
              key={preset.name}
              variant="outline"
              size="sm"
              onClick={() => updateTheme(preset.theme)}
            >
              {preset.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Theme Options */}
      <div className="flex-1 overflow-auto p-4">
        <Accordion type="multiple" defaultValue={["background", "colors", "typography", "layout"]}>
          {/* Background */}
          <AccordionItem value="background">
            <AccordionTrigger>Background</AccordionTrigger>
            <AccordionContent>
              <BackgroundMediaUpload theme={theme} onChange={updateTheme} />
            </AccordionContent>
          </AccordionItem>

          {/* Colors */}
          <AccordionItem value="colors">
            <AccordionTrigger>Colors</AccordionTrigger>
            <AccordionContent className="space-y-4">
              <div className="space-y-2">
                <Label>Accent Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={theme.accentColor || "#6366f1"}
                    onChange={(e) => updateTheme({ accentColor: e.target.value })}
                    className="w-12 h-9 p-1 cursor-pointer"
                  />
                  <Input
                    value={theme.accentColor || ""}
                    onChange={(e) => updateTheme({ accentColor: e.target.value })}
                    placeholder="e.g., #6366f1"
                    className="flex-1"
                  />
                  {theme.accentColor && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateTheme({ accentColor: undefined })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Widget Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={theme.cardBackground || "#1a1a2e"}
                    onChange={(e) => updateTheme({ cardBackground: e.target.value })}
                    className="w-12 h-9 p-1 cursor-pointer"
                  />
                  <Input
                    value={theme.cardBackground || ""}
                    onChange={(e) => updateTheme({ cardBackground: e.target.value })}
                    placeholder="e.g., #1a1a2e"
                    className="flex-1"
                  />
                  {theme.cardBackground && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateTheme({ cardBackground: undefined })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Background color for all widget cards
                </p>
              </div>

              <div className="space-y-2">
                <Label>Card Opacity</Label>
                <Slider
                  value={[theme.cardOpacity ?? 100]}
                  onValueChange={([value]) => updateTheme({ cardOpacity: value })}
                  min={50}
                  max={100}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">
                  {theme.cardOpacity ?? 100}%
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Typography */}
          <AccordionItem value="typography">
            <AccordionTrigger>Typography</AccordionTrigger>
            <AccordionContent className="space-y-4">
              <div className="space-y-2">
                <Label>Font Family</Label>
                <Select
                  value={theme.fontFamily || "default"}
                  onValueChange={(value) =>
                    updateTheme({ fontFamily: value === "default" ? undefined : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Font Size</Label>
                <Select
                  value={theme.fontSize || "medium"}
                  onValueChange={(value) =>
                    updateTheme({ fontSize: value as DashboardTheme["fontSize"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Layout */}
          <AccordionItem value="layout">
            <AccordionTrigger>Layout</AccordionTrigger>
            <AccordionContent className="space-y-4">
              <div className="space-y-2">
                <Label>Spacing</Label>
                <Select
                  value={theme.spacing || "normal"}
                  onValueChange={(value) =>
                    updateTheme({ spacing: value as DashboardTheme["spacing"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="relaxed">Relaxed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Border Radius</Label>
                <Select
                  value={theme.borderRadius || "medium"}
                  onValueChange={(value) =>
                    updateTheme({ borderRadius: value as DashboardTheme["borderRadius"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
