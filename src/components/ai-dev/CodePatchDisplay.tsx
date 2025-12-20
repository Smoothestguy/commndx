import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Copy, ChevronDown, ChevronUp, FileCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Patch {
  file: string;
  explanation: string;
  code: string;
}

interface CodePatchDisplayProps {
  patches: Patch[];
}

export function CodePatchDisplay({ patches }: CodePatchDisplayProps) {
  const { toast } = useToast();
  const [expandedPatches, setExpandedPatches] = useState<Record<number, boolean>>(
    Object.fromEntries(patches.map((_, i) => [i, true]))
  );
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const togglePatch = (index: number) => {
    setExpandedPatches((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const copyCode = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      toast({
        title: "Copied!",
        description: "Code copied to clipboard",
      });
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  if (patches.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-sm flex items-center gap-2">
        <FileCode className="h-4 w-4" />
        Code Patches ({patches.length})
      </h4>
      
      {patches.map((patch, index) => (
        <Card key={index} className="overflow-hidden">
          <CardHeader 
            className="py-2 px-3 cursor-pointer bg-muted/50 hover:bg-muted/70 transition-colors"
            onClick={() => togglePatch(index)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-mono text-primary">
                {patch.file}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyCode(patch.code, index);
                  }}
                >
                  {copiedIndex === index ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                {expandedPatches[index] ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
          
          {expandedPatches[index] && (
            <CardContent className="p-0">
              {patch.explanation && (
                <div className="px-3 py-2 text-xs text-muted-foreground border-b bg-muted/30">
                  {patch.explanation}
                </div>
              )}
              <pre className="p-3 text-xs overflow-x-auto bg-zinc-950 text-zinc-100">
                <code>{patch.code}</code>
              </pre>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
