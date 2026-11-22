import { useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { ImageDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface Summary { found: number; already_present: number; recovered: number; no_conversation: number; media_failures: number; errors: number }

export function RecoverSmsPhotosCard() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  const run = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("backfill-sms-media", { body: {} });
    setRunning(false);
    if (error) {
      const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
      toast({ title: "Could not recover photos", description: details, variant: "destructive" });
      return;
    }
    setSummary(data as Summary);
    toast({ title: "Photo recovery finished", description: `${(data as Summary).recovered} message(s) recovered.` });
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30">
        <CardTitle className="text-base">Messaging — recover missed photos</CardTitle>
        <CardDescription>Pull picture texts from the last 30 days that never reached Messages.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-5">
        <Button onClick={run} disabled={running}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageDown className="mr-2 h-4 w-4" />}
          Recover missed photos
        </Button>
        {summary && (
          <p className="text-sm text-muted-foreground">
            Found {summary.found} picture texts · recovered {summary.recovered} · already in Messages {summary.already_present} ·
            no matching conversation {summary.no_conversation} · download problems {summary.media_failures} · errors {summary.errors}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
