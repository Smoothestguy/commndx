// Creates the account for a pending invitation (public sign-ups are disabled) and applies the invite.
// Never logs the password.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const Body = z.object({
  token: z.string().min(16).max(200),
  password: z.string().min(8).max(200),
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
});
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let parsed;
  try { parsed = Body.safeParse(await req.json()); } catch { return json({ error: "Invalid request" }, 400); }
  if (!parsed.success) return json({ error: "Please fill in your name and a password of at least 8 characters." }, 400);
  const { token, password, first_name, last_name } = parsed.data;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Claim the invitation atomically so it can only be used once.
  const { data: inv, error: claimErr } = await admin.from("invitations")
    .update({ status: "accepted", used_at: new Date().toISOString() })
    .eq("token", token).eq("status", "pending").gt("expires_at", new Date().toISOString())
    .select("id, email, role, personnel_id").maybeSingle();
  if (claimErr) { console.error("claim failed", claimErr.message); return json({ error: "Could not process invitation" }, 500); }
  if (!inv) return json({ error: "This invitation is invalid, already used or expired." }, 410);

  const release = () => admin.from("invitations").update({ status: "pending", used_at: null }).eq("id", inv.id);

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: inv.email, password, email_confirm: true, user_metadata: { first_name, last_name },
  });
  if (createErr || !created.user) {
    await release();
    const msg = createErr?.message ?? "";
    if (/already|registered|exists/i.test(msg)) {
      return json({ error: "An account with this email already exists. Use the Existing Account tab to sign in.", code: "user_exists" }, 409);
    }
    if (/password/i.test(msg)) return json({ error: msg }, 400);
    console.error("createUser failed", msg);
    return json({ error: "Could not create the account" }, 500);
  }
  const userId = created.user.id;

  try {
    const role = inv.personnel_id ? "personnel" : inv.role;
    const { error: pErr } = await admin.from("profiles")
      .upsert({ id: userId, email: inv.email, first_name, last_name }, { onConflict: "id" });
    if (pErr) throw pErr;
    const { error: dErr } = await admin.from("user_roles").delete().eq("user_id", userId);
    if (dErr) throw dErr;
    const { error: rErr } = await admin.from("user_roles").insert({ user_id: userId, role });
    if (rErr) throw rErr;
    if (inv.personnel_id) {
      const { error: lErr } = await admin.from("personnel").update({ user_id: userId }).eq("id", inv.personnel_id);
      if (lErr) throw lErr;
    }
    // Customer links are keyed by email; report whether one is active for this address.
    const { data: link } = await admin.from("customer_user_links").select("id")
      .ilike("email", inv.email).is("revoked_at", null).limit(1);
    await admin.from("invitation_activity_log").insert({
      invitation_id: inv.id, action: "accepted", performed_by: userId, performed_by_email: inv.email,
      target_email: inv.email, target_role: role, metadata: { accepted_at: new Date().toISOString(), via: "signup" },
    });
    return json({ success: true, email: inv.email, role, customer_linked: !!(link && link.length), invitation_id: inv.id });
  } catch (e) {
    console.error("accept step failed", e instanceof Error ? e.message : JSON.stringify(e));
    await admin.auth.admin.deleteUser(userId);
    await release();
    return json({ error: "Could not finish setting up the account. Please try again." }, 500);
  }
});
