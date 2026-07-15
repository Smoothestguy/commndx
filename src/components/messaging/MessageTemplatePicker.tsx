import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Settings, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMessageTemplates, MessageTemplate } from "@/integrations/supabase/hooks/useMessageTemplates";
import { useUserRole } from "@/hooks/useUserRole";
import { MessageTemplateManagerDialog } from "./MessageTemplateManagerDialog";

interface Props {
  onInsert: (content: string) => void;
  disabled?: boolean;
  size?: "sm" | "icon";
}

export function MessageTemplatePicker({ onInsert, disabled, size = "icon" }: Props) {
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const { data: templates, isLoading } = useMessageTemplates(false);
  const { isAdmin, isManager } = useUserRole();
  const canManage = isAdmin || isManager;

  const grouped = useMemo(() => {
    const map = new Map<string, MessageTemplate[]>();
    (templates || []).forEach((t) => {
      const cat = t.category || "General";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(t);
    });
    return Array.from(map.entries());
  }, [templates]);

  const pick = (content: string | null) => {
    if (!content) return;
    onInsert(content);
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size={size}
            disabled={disabled}
            className={cn(size === "icon" && "h-11 w-11 shrink-0")}
            title="Insert template"
          >
            <FileText className={cn(size === "icon" ? "h-5 w-5" : "h-4 w-4", size === "sm" && "mr-1")} />
            {size === "sm" && "Templates"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="px-3 py-2 border-b text-sm font-semibold">Message templates</div>
          <ScrollArea className="max-h-80">
            <div className="p-2 space-y-3">
              {isLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-3">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                </div>
              )}
              {!isLoading && grouped.length === 0 && (
                <div className="text-xs text-muted-foreground px-2 py-3">No templates yet.</div>
              )}
              {grouped.map(([cat, items]) => (
                <div key={cat}>
                  <div className="px-2 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {cat}
                  </div>
                  <div className="space-y-1">
                    {items.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-md px-2 py-1.5 hover:bg-muted/50 flex items-center gap-2"
                      >
                        <div className="flex-1 min-w-0 text-sm truncate">{t.name}</div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          disabled={!t.content_en}
                          onClick={() => pick(t.content_en)}
                        >
                          EN
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          disabled={!t.content_es}
                          onClick={() => pick(t.content_es)}
                        >
                          ES
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          {canManage && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  setOpen(false);
                  setManageOpen(true);
                }}
              >
                <Settings className="h-4 w-4 mr-2" /> Manage templates
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {canManage && (
        <MessageTemplateManagerDialog open={manageOpen} onOpenChange={setManageOpen} />
      )}
    </>
  );
}
