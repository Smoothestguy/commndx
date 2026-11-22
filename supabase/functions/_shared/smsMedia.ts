// Shared inbound SMS/MMS helpers for twilio-webhook and backfill-sms-media.
// deno-lint-ignore-file no-explicit-any
export interface PossibleSender { type: "personnel" | "customer" | "applicant"; id: string; name: string }
export interface MediaItem { url: string; contentType: string }
export interface StoredMedia { path: string; content_type: string; size: number }
export interface MediaError { index: number; content_type: string; error: string }

export function getPhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp",
  "image/heic": "heic", "image/heif": "heif", "image/bmp": "bmp", "application/pdf": "pdf",
  "video/mp4": "mp4", "video/3gpp": "3gp", "video/quicktime": "mov", "audio/amr": "amr", "audio/mpeg": "mp3",
  "audio/ogg": "ogg", "text/vcard": "vcf", "text/x-vcard": "vcf", "text/plain": "txt",
};
export function extFor(contentType: string): string {
  const ct = (contentType || "").toLowerCase().split(";")[0].trim();
  return EXT[ct] ?? (ct.split("/")[1]?.replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin");
}

export function previewFor(body: string, media: { contentType?: string; content_type?: string }[]): string {
  if (body) return body.substring(0, 100);
  if (!media.length) return "";
  const allImages = media.every((m) => (m.contentType ?? m.content_type ?? "").startsWith("image/"));
  return allImages ? "📷 Photo" : "📎 Attachment";
}

export async function findSenders(supabase: any, from: string): Promise<PossibleSender[]> {
  const digits = getPhoneDigits(from);
  const [{ data: p }, { data: c }, { data: a }] = await Promise.all([
    supabase.from("personnel").select("id, first_name, last_name, phone").not("phone", "is", null),
    supabase.from("customers").select("id, name, phone").not("phone", "is", null),
    supabase.from("applicants").select("id, first_name, last_name, phone").not("phone", "is", null),
  ]);
  const m = (x: any) => x.phone && getPhoneDigits(x.phone) === digits;
  return [
    ...(p || []).filter(m).map((x: any) => ({ type: "personnel" as const, id: x.id, name: `${x.first_name} ${x.last_name}` })),
    ...(c || []).filter(m).map((x: any) => ({ type: "customer" as const, id: x.id, name: x.name })),
    ...(a || []).filter(m).map((x: any) => ({ type: "applicant" as const, id: x.id, name: `${x.first_name} ${x.last_name}` })),
  ];
}

export async function findExistingConversation(supabase: any, senders: PossibleSender[]) {
  for (const s of senders) {
    const { data } = await supabase.from("conversations").select("id, last_message_at")
      .or(`and(participant_1_type.eq.${s.type},participant_1_id.eq.${s.id}),and(participant_2_type.eq.${s.type},participant_2_id.eq.${s.id})`)
      .order("last_message_at", { ascending: false }).limit(1).maybeSingle();
    if (data) return { conversationId: data.id as string, sender: s };
  }
  return null;
}

export function twilioAuthHeader(): string {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
  const token = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
  return "Basic " + btoa(`${sid}:${token}`);
}

/** Downloads each Twilio media URL and stores it privately. Failures are recorded, never thrown. */
export async function storeMedia(supabase: any, conversationId: string, messageSid: string, items: MediaItem[]) {
  const media: StoredMedia[] = [];
  const media_errors: MediaError[] = [];
  const safeSid = (messageSid || crypto.randomUUID()).replace(/[^A-Za-z0-9_-]/g, "");
  for (let i = 0; i < items.length; i++) {
    const { url, contentType } = items[i];
    try {
      const res = await fetch(url, { headers: { Authorization: twilioAuthHeader() }, redirect: "follow" });
      if (!res.ok) throw new Error(`download ${res.status}`);
      const ct = contentType || res.headers.get("content-type") || "application/octet-stream";
      const bytes = new Uint8Array(await res.arrayBuffer());
      const path = `${conversationId}/${safeSid}_${i}.${extFor(ct)}`;
      const { error } = await supabase.storage.from("sms-media").upload(path, bytes, { contentType: ct, upsert: true });
      if (error) throw new Error(`upload: ${error.message}`);
      media.push({ path, content_type: ct, size: bytes.byteLength });
    } catch (e) {
      media_errors.push({ index: i, content_type: contentType, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { media, media_errors };
}

export function buildMetadata(messageSid: string, stored: { media: StoredMedia[]; media_errors: MediaError[] }) {
  const md: Record<string, unknown> = { twilio_sid: messageSid || null };
  if (stored.media.length) md.media = stored.media;
  if (stored.media_errors.length) md.media_errors = stored.media_errors;
  return md;
}
