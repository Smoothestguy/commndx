import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Loader2, AlertTriangle, ShieldAlert, Database, Lock, ChevronRight, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MappingAnalysis {
  summary: string;
  entity_overview: Array<{
    entity: string;
    unmapped_count: number;
    open_count?: number;
    total_open_amount?: number | null;
    oldest_age_days?: number | null;
    likely_root_causes: string[];
  }>;
  critical_items: Array<{
    entity: string;
    priority: "high" | "medium" | "low";
    impact: {
      amount?: number | null;
      count: number;
      oldest_age_days?: number | null;
    };
    reason: string;
    root_cause: string;
    confidence: "high" | "medium" | "low";
    records?: Array<{ id: string; summary: string }>;
    next_actions: string[];
  }>;
  recommendations: Array<{
    order: number;
    title: string;
    rationale: string;
    steps: string[];
    risk_if_ignored: string;
  }>;
  warnings: Array<{
    type: "tax" | "accounting" | "data" | "permissions";
    message: string;
  }>;
}

const priorityColors: Record<string, string> = {
  high: "bg-destructive text-destructive-foreground",
  medium: "bg-yellow-500/90 text-white",
  low: "bg-muted text-muted-foreground",
};

const warningIcons: Record<string, typeof AlertTriangle> = {
  tax: ShieldAlert,
  accounting: AlertTriangle,
  data: Database,
  permissions: Lock,
};

const warningColors: Record<string, string> = {
  tax: "border-destructive/50 bg-destructive/5",
  accounting: "border-yellow-500/50 bg-yellow-500/5",
  data: "border-blue-500/50 bg-blue-500/5",
  permissions: "border-orange-500/50 bg-orange-500/5",
};

export function MappingAdvisor() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<MappingAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("quickbooks-mapping-advisor");

      if (fnError) throw fnError;

      if (data?.error) {
        setError(data.error);
        return;
      }

      setAnalysis(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to analyze mappings";
      setError(msg);
      toast.error("AI Advisor failed", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    if (!analysis && !loading) {
      runAnalysis();
    }
  };

  return (
    <>
      <Button variant="ghost" size="icon" onClick={handleOpen} title="AI Mapping Advisor">
        <Sparkles className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Mapping Advisor
            </DialogTitle>
            <DialogDescription>
              Expert analysis of your QuickBooks sync status with prioritized recommendations
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            {loading && (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="text-center">
                  <p className="font-medium">Analyzing your mapping data…</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Checking all 7 entity types for risks and priorities
                  </p>
                </div>
              </div>
            )}

            {error && (
              <Alert variant="destructive" className="my-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Analysis Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {analysis && (
              <div className="space-y-6 pb-4">
                {/* Summary */}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Info className="h-4 w-4" /> Summary
                  </h3>
                  <p className="text-sm leading-relaxed">{analysis.summary}</p>
                </div>

                {/* Critical Items */}
                {analysis.critical_items?.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-sm mb-3">Critical Items</h3>
                    <div className="space-y-3">
                      {analysis.critical_items.map((item, i) => (
                        <Card key={i} className="border-l-4" style={{
                          borderLeftColor: item.priority === "high" ? "hsl(var(--destructive))" : item.priority === "medium" ? "#eab308" : "hsl(var(--muted))",
                        }}>
                          <CardHeader className="p-3 pb-1">
                            <div className="flex items-center justify-between gap-2">
                              <CardTitle className="text-sm font-medium">{item.entity}</CardTitle>
                              <div className="flex items-center gap-2">
                                <Badge className={`text-[10px] ${priorityColors[item.priority]}`}>
                                  {item.priority}
                                </Badge>
                                {item.impact?.amount != null && (
                                  <span className="text-xs font-mono text-muted-foreground">
                                    ${item.impact.amount.toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-3 pt-0 space-y-2">
                            <p className="text-xs text-muted-foreground">{item.reason}</p>
                            <div className="text-xs">
                              <span className="font-medium">Root cause:</span>{" "}
                              <span className="text-muted-foreground">{item.root_cause}</span>
                            </div>
                            {item.records && item.records.length > 0 && (
                              <div className="text-xs space-y-1">
                                <span className="font-medium">Sample records:</span>
                                <ul className="list-disc list-inside text-muted-foreground">
                                  {item.records.slice(0, 5).map((r, ri) => (
                                    <li key={ri}>{r.summary}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {item.next_actions.length > 0 && (
                              <div className="text-xs space-y-1">
                                <span className="font-medium">Next steps:</span>
                                <ul className="space-y-0.5">
                                  {item.next_actions.map((a, ai) => (
                                    <li key={ai} className="flex items-start gap-1 text-muted-foreground">
                                      <ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />
                                      {a}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {analysis.recommendations?.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-sm mb-3">Recommended Sync Order</h3>
                    <div className="space-y-3">
                      {analysis.recommendations
                        .sort((a, b) => a.order - b.order)
                        .map((rec) => (
                          <div key={rec.order} className="rounded-lg border p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">
                                {rec.order}
                              </span>
                              <span className="font-medium text-sm">{rec.title}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{rec.rationale}</p>
                            <div className="text-xs space-y-0.5">
                              {rec.steps.map((s, si) => (
                                <div key={si} className="flex items-start gap-1 text-muted-foreground">
                                  <ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />
                                  {s}
                                </div>
                              ))}
                            </div>
                            <p className="text-[10px] text-destructive/80 italic">
                              ⚠ Risk if ignored: {rec.risk_if_ignored}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {analysis.warnings?.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-sm mb-3">Warnings</h3>
                    <div className="space-y-2">
                      {analysis.warnings.map((w, i) => {
                        const Icon = warningIcons[w.type] || AlertTriangle;
                        return (
                          <div key={i} className={`rounded-lg border p-3 flex items-start gap-2 ${warningColors[w.type] || ""}`}>
                            <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[10px] font-semibold uppercase tracking-wider">{w.type}</span>
                              <p className="text-xs mt-0.5">{w.message}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Re-run button */}
                <div className="flex justify-end pt-2">
                  <Button variant="outline" size="sm" onClick={runAnalysis} disabled={loading}>
                    {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                    Re-analyze
                  </Button>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
