import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, CheckCircle2, AlertTriangle, MapPin, Pencil } from "lucide-react";
import { toast } from "sonner";
import { SEO } from "@/components/SEO";

type Applicant = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
  city: string | null;
  state: string | null;
  home_zip: string | null;
};
type Posting = {
  id: string;
  public_token: string;
  is_open: boolean;
  title: string | null;
  project_name: string | null;
  project_city: string | null;
  project_state: string | null;
};

export default function QuickApply() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<{
    valid: boolean;
    used?: boolean;
    reason?: string;
    already_applied?: boolean;
    posting?: Posting;
    applicant?: Applicant;
    public_token?: string;
    posting_title?: string;
  } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_quick_apply_invite", { _token: token });
      if (error) toast.error(error.message);
      const parsed = (data as any) ?? { valid: false };
      setInvite(parsed);
      if (parsed?.applicant) {
        setPhone(parsed.applicant.phone ?? "");
        setEmail(parsed.applicant.email ?? "");
      }
      setLoading(false);
    })();
  }, [token]);

  const handleConfirm = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("confirm_quick_apply", {
        _token: token,
        _phone: phone || null,
        _email: email || null,
      });
      if (error) throw error;
      const res = data as any;
      if (!res?.success) throw new Error(res?.error || "Failed to submit");
      setSubmitted(true);
    } catch (e: any) {
      toast.error(e?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invite?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Link no longer valid
            </CardTitle>
            <CardDescription>
              {invite?.reason === "expired"
                ? "This invite has expired."
                : "We couldn't find that invite."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invite?.public_token ? (
              <Button asChild className="w-full">
                <Link to={`/apply/${invite.public_token}`}>Apply on the regular form</Link>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Please contact us to receive a new link.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted || invite.used) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <CardTitle>You're in!</CardTitle>
            <CardDescription>
              Your application for {invite.posting?.title || invite.posting_title || "this position"} has been received.
              We'll be in touch soon.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (invite.already_applied) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
            <CardTitle>You've already applied</CardTitle>
            <CardDescription>
              You have an active application for {invite.posting?.title}. No further action needed.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const a = invite.applicant!;
  const p = invite.posting!;
  const initials = `${a.first_name?.[0] ?? ""}${a.last_name?.[0] ?? ""}`.toUpperCase();
  const projLoc = [p.project_city, p.project_state].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <SEO title="Quick Apply — Fairfield Response Group" description="Confirm your info and apply in one tap." />
      <div className="max-w-lg mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{p.title || p.project_name}</CardTitle>
            {(p.project_name || projLoc) && (
              <CardDescription className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {p.project_name}{projLoc && ` · ${projLoc}`}
              </CardDescription>
            )}
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your info on file</CardTitle>
            <CardDescription>Review and confirm — we'll use this for your application.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14">
                {a.photo_url ? <AvatarImage src={a.photo_url} alt="" /> : null}
                <AvatarFallback>{initials || "?"}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-semibold">{a.first_name} {a.last_name}</div>
                <div className="text-sm text-muted-foreground">
                  {[a.city, a.state, a.home_zip].filter(Boolean).join(", ") || "No location on file"}
                </div>
              </div>
            </div>

            {!editMode ? (
              <div className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Phone:</span> {phone || "—"}</div>
                <div><span className="text-muted-foreground">Email:</span> {email || "—"}</div>
                <Button size="sm" variant="ghost" onClick={() => setEditMode(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit contact info
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" />
                </div>
              </div>
            )}

            <Alert>
              <AlertTitle className="text-sm">One-tap apply</AlertTitle>
              <AlertDescription className="text-xs">
                By confirming, you're submitting an application for this position using the info above.
              </AlertDescription>
            </Alert>

            <Button className="w-full h-12 text-base" onClick={handleConfirm} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirm & Apply
            </Button>

            <div className="text-center">
              <Link to={`/apply/${p.public_token}`} className="text-xs text-muted-foreground underline">
                Need to update more info? Use the full form
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
