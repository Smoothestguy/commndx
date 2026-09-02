// apply-share
//
// Why this exists: the applicant-facing form at /apply/<token> lives inside a
// client-rendered SPA. Social/messaging crawlers (Facebook, WhatsApp, iMessage,
// LinkedIn, Slack...) never execute JS, so they only ever see the static
// index.html <head> — which advertises the Command X product, not the job.
// This function is a share-safe wrapper: bots get server-rendered Open Graph
// tags describing the actual job posting (title, pay, location, start date,
// openings) with Fairfield Response Group branding, while real humans get a
// 302 straight to the normal apply URL.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE = "https://fairfieldrg.com";
const OG_IMAGE = `${SITE}/images/company-logo.png`;
const BRAND = "Fairfield Response Group";

const BOT_PATTERNS = [
  "facebookexternalhit",
  "facebot",
  "twitterbot",
  "linkedinbot",
  "whatsapp",
  "slackbot",
  "telegrambot",
  "discordbot",
  "applebot",
  "googlebot",
  "bingbot",
  "pinterest",
  "skypeuripreview",
  "imessage",
  "bot",
  "crawler",
  "spider",
  "preview",
];

function isBot(ua: string): boolean {
  const l = ua.toLowerCase();
  return BOT_PATTERNS.some((p) => l.includes(p));
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shortLocation(address?: string | null): string | null {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return parts.slice(-2).join(", ");
}

function formatRate(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

function buildHtml(opts: {
  title: string;
  description: string;
  url: string;
}): string {
  const t = esc(opts.title);
  const d = esc(opts.description);
  const u = esc(opts.url);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${u}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${esc(BRAND)}" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:url" content="${u}" />
<meta property="og:image" content="${esc(OG_IMAGE)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${esc(OG_IMAGE)}" />
<meta http-equiv="refresh" content="0;url=${u}" />
</head>
<body>
<p><a href="${u}">${t}</a></p>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] || "";
  const token = (url.searchParams.get("t") || (last === "apply-share" ? "" : last) || "").trim();

  const applyUrl = `${SITE}/apply/${encodeURIComponent(token)}`;
  const htmlHeaders = {
    ...corsHeaders,
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "public, max-age=300",
  };

  let title = `Position no longer available — ${BRAND}`;
  let description = `Apply in 2 minutes — short questionnaire.`;

  if (token) {
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } },
      );

      const { data: posting } = await supabase
        .from("job_postings")
        .select(
          "id, task_order_id, is_open, project_task_orders(title, location_address, start_at, headcount_needed, job_description)",
        )
        .eq("public_token", token)
        .eq("is_open", true)
        .maybeSingle();

      const to = (posting as any)?.project_task_orders as
        | {
            title?: string | null;
            location_address?: string | null;
            start_at?: string | null;
            headcount_needed?: number | null;
            job_description?: string | null;
          }
        | null;

      if (posting && to) {
        const { data: positions } = await supabase
          .from("task_order_positions")
          .select("position_label, advertised_pay_rate, show_pay_publicly")
          .eq("task_order_id", (posting as any).task_order_id);

        title = `${to.title || "Open position"} — ${BRAND}`;

        const parts: string[] = [];

        const rates = (positions ?? [])
          .filter((p: any) => p.show_pay_publicly && p.advertised_pay_rate != null)
          .map((p: any) => Number(p.advertised_pay_rate))
          .filter((n: number) => Number.isFinite(n));
        if (rates.length > 0) {
          const min = Math.min(...rates);
          const max = Math.max(...rates);
          parts.push(min === max ? `${formatRate(min)}/hr` : `${formatRate(min)}–${formatRate(max)}/hr`);
        }

        if (to.start_at) {
          const d = new Date(to.start_at);
          if (!isNaN(d.getTime())) {
            parts.push(
              `Starts ${d.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              })}`,
            );
          }
        }

        const loc = shortLocation(to.location_address);
        if (loc) parts.push(loc);

        if (to.headcount_needed && to.headcount_needed > 0) {
          parts.push(`${to.headcount_needed} opening${to.headcount_needed === 1 ? "" : "s"}`);
        }

        parts.push("Apply in 2 minutes — short questionnaire.");

        let desc = parts.join(" · ");
        if (desc.length > 200) desc = desc.slice(0, 197).trimEnd() + "…";
        description = desc;
      }
    } catch (e) {
      console.error("[apply-share] lookup failed", e);
    }
  }

  if (isBot(req.headers.get("user-agent") ?? "")) {
    return new Response(buildHtml({ title, description, url: applyUrl }), {
      status: 200,
      headers: htmlHeaders,
    });
  }

  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: applyUrl, "Cache-Control": "public, max-age=300" },
  });
});
