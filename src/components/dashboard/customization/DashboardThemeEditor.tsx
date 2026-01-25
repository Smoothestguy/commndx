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
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

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
      density: "normal",
    },
  },
  {
    name: "2K1 View",
    theme: {
      fontFamily: "default",
      fontSize: "small",
      spacing: "compact",
      borderRadius: "small",
      density: "2k1",
    },
  },
  {
    name: "Compact",
    theme: {
      fontSize: "small",
      spacing: "compact",
      borderRadius: "small",
      density: "normal",
    },
  },
  {
    name: "Spreadsheet",
    theme: {
      fontSize: "small",
      spacing: "compact",
      borderRadius: "none",
      density: "spreadsheet",
      cardOpacity: 100,
    },
  },
  {
    name: "Spacious",
    theme: {
      fontSize: "large",
      spacing: "relaxed",
      borderRadius: "large",
      density: "normal",
    },
  },
  {
    name: "Dark Accent",
    theme: {
      accentColor: "#6366f1",
      borderRadius: "medium",
      density: "normal",
    },
  },
  {
    name: "Warm",
    theme: {
      accentColor: "#f59e0b",
      borderRadius: "large",
      density: "normal",
    },
  },
];

export function DashboardThemeEditor({
  theme,
  onChange,
  isOpen,
  onClose,
}: DashboardThemeEditorProps) {
  const isMobile = useIsMobile();

  if (!isOpen) return null;

  const updateTheme = (updates: Partial<DashboardTheme>) => {
    onChange({ ...theme, ...updates });
  };

  return (
    <>
      {/* Mobile overlay backdrop - lighter so dashboard is visible */}
      {isMobile && (
        <div 
          className="fixed inset-0 bg-black/20 z-[199]"
          onClick={onClose}
        />
      )}
      
      <div className={cn(
        "fixed bg-background border shadow-lg z-[200] flex flex-col",
        // Mobile: Bottom sheet that takes ~70% height, allowing dashboard to peek above
        "inset-x-0 bottom-0 rounded-t-xl max-h-[70vh] border-t",
        // Desktop: Right sidebar
        "sm:inset-x-auto sm:right-0 sm:top-14 sm:bottom-0 sm:w-80 sm:rounded-none sm:max-h-none sm:border-l sm:border-t-0",
        // Animation
        "animate-slide-in-up sm:animate-slide-in-right"
      )}>
        {/* Drag handle for mobile bottom sheet */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between shrink-0">
          <h3 className="font-semibold">Theme Settings</h3>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="h-10 w-10 sm:h-8 sm:w-8"
          >
            <X className="h-5 w-5 sm:h-4 sm:w-4" />
          </Button>
        </div>

        {/* Preset Themes */}
        <div className="p-4 border-b shrink-0">
          <Label className="text-sm font-medium mb-2 block">Quick Presets</Label>
          <div className="flex flex-wrap gap-2">
            {PRESET_THEMES.map((preset) => (
              <Button
                key={preset.name}
                variant="outline"
                size="sm"
                onClick={() => updateTheme(preset.theme)}
                className="h-10 sm:h-8 px-3 active:scale-[0.96] transition-transform"
              >
                {preset.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Theme Options - Scrollable area */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="p-4">
            <Accordion type="multiple" defaultValue={["background", "colors", "typography", "layout"]}>
              {/* Background */}
              <AccordionItem value="background">
                <AccordionTrigger className="py-3">Background</AccordionTrigger>
                <AccordionContent>
                  <BackgroundMediaUpload theme={theme} onChange={updateTheme} />
                </AccordionContent>
              </AccordionItem>

              {/* Colors */}
              <AccordionItem value="colors">
                <AccordionTrigger className="py-3">Colors</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Accent Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={theme.accentColor || "#6366f1"}
                        onChange={(e) => updateTheme({ accentColor: e.target.value })}
                        className="w-12 h-11 sm:h-9 p-1 cursor-pointer"
                      />
                      <Input
                        value={theme.accentColor || ""}
                        onChange={(e) => updateTheme({ accentColor: e.target.value })}
                        placeholder="e.g., #6366f1"
                        className="flex-1 h-11 sm:h-9"
                      />
                      {theme.accentColor && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateTheme({ accentColor: undefined })}
                          className="h-11 w-11 sm:h-9 sm:w-9 shrink-0"
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
                        className="w-12 h-11 sm:h-9 p-1 cursor-pointer"
                      />
                      <Input
                        value={theme.cardBackground || ""}
                        onChange={(e) => updateTheme({ cardBackground: e.target.value })}
                        placeholder="e.g., #1a1a2e"
                        className="flex-1 h-11 sm:h-9"
                      />
                      {theme.cardBackground && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateTheme({ cardBackground: undefined })}
                          className="h-11 w-11 sm:h-9 sm:w-9 shrink-0"
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
                    <Label>Widget Text Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={theme.cardTextColor || "#ffffff"}
                        onChange={(e) => updateTheme({ cardTextColor: e.target.value })}
                        className="w-12 h-11 sm:h-9 p-1 cursor-pointer"
                      />
                      <Input
                        value={theme.cardTextColor || ""}
                        onChange={(e) => updateTheme({ cardTextColor: e.target.value })}
                        placeholder="e.g., #ffffff"
                        className="flex-1 h-11 sm:h-9"
                      />
                      {theme.cardTextColor && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateTheme({ cardTextColor: undefined })}
                          className="h-11 w-11 sm:h-9 sm:w-9 shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Text color for all widget cards
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
                      className="py-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      {theme.cardOpacity ?? 100}%
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Typography */}
              <AccordionItem value="typography">
                <AccordionTrigger className="py-3">Typography</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Font Family</Label>
                    <Select
                      value={theme.fontFamily || "default"}
                      onValueChange={(value) =>
                        updateTheme({ fontFamily: value === "default" ? undefined : value })
                      }
                    >
                      <SelectTrigger className="h-11 sm:h-9">
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
                      <SelectTrigger className="h-11 sm:h-9">
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
                <AccordionTrigger className="py-3">Layout</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Spacing</Label>
                    <Select
                      value={theme.spacing || "normal"}
                      onValueChange={(value) =>
                        updateTheme({ spacing: value as DashboardTheme["spacing"] })
                      }
                    >
                      <SelectTrigger className="h-11 sm:h-9">
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
                      <SelectTrigger className="h-11 sm:h-9">
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

                  <div className="space-y-2">
                    <Label>Density</Label>
                    <Select
                      value={theme.density || "normal"}
                      onValueChange={(value) =>
                        updateTheme({ density: value as DashboardTheme["density"] })
                      }
                    >
                      <SelectTrigger className="h-11 sm:h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="2k1">2K1 View (Condensed)</SelectItem>
                        <SelectItem value="spreadsheet">Spreadsheet (Ultra Dense)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      2K1 View reduces spacing ~30% for more data on screen
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Sidebars */}
              <AccordionItem value="sidebars">
                <AccordionTrigger className="py-3">Sidebars</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Left Panel Background</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={theme.leftSidebarBackground || "#1a1a2e"}
                        onChange={(e) => updateTheme({ leftSidebarBackground: e.target.value })}
                        className="w-12 h-11 sm:h-9 p-1 cursor-pointer"
                      />
                      <Input
                        value={theme.leftSidebarBackground || ""}
                        onChange={(e) => updateTheme({ leftSidebarBackground: e.target.value })}
                        placeholder="e.g., #1a1a2e"
                        className="flex-1 h-11 sm:h-9"
                      />
                      {theme.leftSidebarBackground && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateTheme({ leftSidebarBackground: undefined })}
                          className="h-11 w-11 sm:h-9 sm:w-9 shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Left Panel Text</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={theme.leftSidebarTextColor || "#ffffff"}
                        onChange={(e) => updateTheme({ leftSidebarTextColor: e.target.value })}
                        className="w-12 h-11 sm:h-9 p-1 cursor-pointer"
                      />
                      <Input
                        value={theme.leftSidebarTextColor || ""}
                        onChange={(e) => updateTheme({ leftSidebarTextColor: e.target.value })}
                        placeholder="e.g., #ffffff"
                        className="flex-1 h-11 sm:h-9"
                      />
                      {theme.leftSidebarTextColor && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateTheme({ leftSidebarTextColor: undefined })}
                          className="h-11 w-11 sm:h-9 sm:w-9 shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Right Panel Background</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={theme.rightSidebarBackground || "#1a1a2e"}
                        onChange={(e) => updateTheme({ rightSidebarBackground: e.target.value })}
                        className="w-12 h-11 sm:h-9 p-1 cursor-pointer"
                      />
                      <Input
                        value={theme.rightSidebarBackground || ""}
                        onChange={(e) => updateTheme({ rightSidebarBackground: e.target.value })}
                        placeholder="e.g., #1a1a2e"
                        className="flex-1 h-11 sm:h-9"
                      />
                      {theme.rightSidebarBackground && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateTheme({ rightSidebarBackground: undefined })}
                          className="h-11 w-11 sm:h-9 sm:w-9 shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Right Panel Text</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={theme.rightSidebarTextColor || "#ffffff"}
                        onChange={(e) => updateTheme({ rightSidebarTextColor: e.target.value })}
                        className="w-12 h-11 sm:h-9 p-1 cursor-pointer"
                      />
                      <Input
                        value={theme.rightSidebarTextColor || ""}
                        onChange={(e) => updateTheme({ rightSidebarTextColor: e.target.value })}
                        placeholder="e.g., #ffffff"
                        className="flex-1 h-11 sm:h-9"
                      />
                      {theme.rightSidebarTextColor && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateTheme({ rightSidebarTextColor: undefined })}
                          className="h-11 w-11 sm:h-9 sm:w-9 shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Navigation Menu */}
              <AccordionItem value="menu">
                <AccordionTrigger className="py-3">Navigation Menu</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Dropdown Background</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={theme.menuBackground || "#1a1a2e"}
                        onChange={(e) => updateTheme({ menuBackground: e.target.value })}
                        className="w-12 h-11 sm:h-9 p-1 cursor-pointer"
                      />
                      <Input
                        value={theme.menuBackground || ""}
                        onChange={(e) => updateTheme({ menuBackground: e.target.value })}
                        placeholder="e.g., #1a1a2e"
                        className="flex-1 h-11 sm:h-9"
                      />
                      {theme.menuBackground && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateTheme({ menuBackground: undefined })}
                          className="h-11 w-11 sm:h-9 sm:w-9 shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Background color for menu dropdowns
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Dropdown Text</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={theme.menuTextColor || "#ffffff"}
                        onChange={(e) => updateTheme({ menuTextColor: e.target.value })}
                        className="w-12 h-11 sm:h-9 p-1 cursor-pointer"
                      />
                      <Input
                        value={theme.menuTextColor || ""}
                        onChange={(e) => updateTheme({ menuTextColor: e.target.value })}
                        placeholder="e.g., #ffffff"
                        className="flex-1 h-11 sm:h-9"
                      />
                      {theme.menuTextColor && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateTheme({ menuTextColor: undefined })}
                          className="h-11 w-11 sm:h-9 sm:w-9 shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Text color for menu items
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        {/* Mobile close button at bottom */}
        {isMobile && (
          <div className="p-4 border-t shrink-0">
            <Button 
              onClick={onClose} 
              className="w-full h-12"
              variant="secondary"
            >
              Done
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
