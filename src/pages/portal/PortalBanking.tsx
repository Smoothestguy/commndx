import { useState } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Landmark, ShieldCheck, Lock } from "lucide-react";
import { useMyBankingInfo, useUpdateMyBankingInfo } from "@/hooks/useWorkerBanking";
import { z } from "zod";
import { formatDistanceToNow } from "date-fns";

const schema = z.object({
  bank_name: z.string().trim().min(1, "Bank name is required").max(100),
  account_type: z.enum(["checking", "savings"]),
  routing_number: z.string().regex(/^\d{9}$/, "Routing number must be exactly 9 digits"),
  account_number: z.string().regex(/^\d{4,17}$/, "Account number must be 4-17 digits"),
  account_number_confirm: z.string(),
}).refine((v) => v.account_number === v.account_number_confirm, {
  message: "Account numbers do not match",
  path: ["account_number_confirm"],
});

const onlyDigits = (v: string) => v.replace(/\D+/g, "");

export default function PortalBanking() {
  const { data: current, isLoading } = useMyBankingInfo();
  const update = useUpdateMyBankingInfo();

  const [bankName, setBankName] = useState("");
  const [accountType, setAccountType] = useState<"checking" | "savings">("checking");
  const [routing, setRouting] = useState("");
  const [account, setAccount] = useState("");
  const [accountConfirm, setAccountConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Prefill bank name / account type from current record once loaded (raw numbers never come back).
  if (current && bankName === "" && current.bank_name) {
    setBankName(current.bank_name);
    if (current.bank_account_type === "checking" || current.bank_account_type === "savings") {
      setAccountType(current.bank_account_type);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      bank_name: bankName,
      account_type: accountType,
      routing_number: routing,
      account_number: account,
      account_number_confirm: accountConfirm,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        const key = String(i.path[0] ?? "form");
        if (!errs[key]) errs[key] = i.message;
      });
      setErrors(errs);
      return;
    }
    setErrors({});
    await update.mutateAsync({
      bank_name: parsed.data.bank_name,
      account_type: parsed.data.account_type,
      routing_number: parsed.data.routing_number,
      account_number: parsed.data.account_number,
    });
    setRouting("");
    setAccount("");
    setAccountConfirm("");
  };

  return (
    <PortalLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Landmark className="h-6 w-6" />
            Banking Information
          </h1>
          <p className="text-muted-foreground">
            Update the account where your direct deposits are sent.
          </p>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 py-4 text-sm">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p>
              Your routing and account numbers are encrypted before they are stored. Only you and payroll/admin staff who process your pay can access them.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current account on file</CardTitle>
            <CardDescription>
              {current?.banking_info_updated_at
                ? `Last updated ${formatDistanceToNow(new Date(current.banking_info_updated_at), { addSuffix: true })}`
                : "No banking info saved yet."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : current?.bank_account_last4 ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Bank</p>
                  <p className="font-medium">{current.bank_name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Account type</p>
                  <p className="font-medium capitalize">{current.bank_account_type ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Account number</p>
                  <p className="font-medium">••••{current.bank_account_last4}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Fill out the form below to set up direct deposit.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Update banking info
            </CardTitle>
            <CardDescription>
              Double-check your entries — mistakes can delay your pay.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bank_name">Bank name</Label>
                <Input
                  id="bank_name"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  maxLength={100}
                  placeholder="e.g. Chase, Bank of America"
                />
                {errors.bank_name && <p className="text-sm text-destructive">{errors.bank_name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="account_type">Account type</Label>
                <Select value={accountType} onValueChange={(v) => setAccountType(v as "checking" | "savings")}>
                  <SelectTrigger id="account_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Checking</SelectItem>
                    <SelectItem value="savings">Savings</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="routing">Routing number (9 digits)</Label>
                <Input
                  id="routing"
                  inputMode="numeric"
                  autoComplete="off"
                  value={routing}
                  onChange={(e) => setRouting(onlyDigits(e.target.value).slice(0, 9))}
                  placeholder="123456789"
                />
                {errors.routing_number && <p className="text-sm text-destructive">{errors.routing_number}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="account">Account number</Label>
                <Input
                  id="account"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={account}
                  onChange={(e) => setAccount(onlyDigits(e.target.value).slice(0, 17))}
                  placeholder="Enter 4-17 digits"
                />
                {errors.account_number && <p className="text-sm text-destructive">{errors.account_number}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="account_confirm">Confirm account number</Label>
                <Input
                  id="account_confirm"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={accountConfirm}
                  onChange={(e) => setAccountConfirm(onlyDigits(e.target.value).slice(0, 17))}
                  placeholder="Re-enter account number"
                />
                {errors.account_number_confirm && (
                  <p className="text-sm text-destructive">{errors.account_number_confirm}</p>
                )}
              </div>

              <Button type="submit" disabled={update.isPending} className="w-full sm:w-auto">
                {update.isPending ? "Saving..." : "Save banking info"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
