

## Step 1: Fix Build Errors + Security Hardening

This plan addresses the 11 build errors in edge functions and implements the security lockdown items that are actionable within Lovable.

---

### Part A: Fix Build Errors (5 edge functions)

**1. `check-missing-time-entries/index.ts` (line 78)**
- Error: `'error' is of type 'unknown'`
- Fix: Cast error before accessing `.message`
```typescript
} catch (error: unknown) {
  const msg = error instanceof Error ? error.message : "Unknown error";
  return new Response(JSON.stringify({ error: msg }), { ... });
}
```

**2. `generate-wh347/index.ts` (lines 441, 483)**
- Error: `Uint8Array` not assignable to `BodyInit`
- Fix: Wrap `pdfBytes` in a `Blob` or convert to `ArrayBuffer`:
```typescript
return new Response(new Uint8Array(pdfBytes).buffer, { ... });
```
Applied to both the single-page (line 441) and multi-page (line 483) response.

**3. `process-co-signature/index.ts` (line 257)**
- Error: `'error' is of type 'unknown'`
- Fix: Same pattern as #1 -- add `error: unknown` annotation and use `instanceof Error` check.

**4. `quickbooks-fetch-journal-entries/index.ts` (lines 79, 86, 110, 215)**
- Root cause: `.single()` returns `never` type because TypeScript cannot infer the table schema in the edge function context.
- Fix: Add an explicit type for the config object and cast the query result:
```typescript
interface QBConfig {
  id: string;
  access_token: string;
  refresh_token: string;
  realm_id: string;
  token_expires_at: string;
  is_connected: boolean;
}
```
Then cast: `const config = data as QBConfig;`
Also fix the `getValidToken` function signature to accept `any` supabase client type to resolve the TS2345 error on line 215.

**5. `quickbooks-void-bill/index.ts` (line 167)**
- Error: Handler returns `Promise<Response | undefined>`
- Fix: Ensure every code path returns a `Response`. Add a fallback `return new Response(...)` at the end of the handler.

**6. `send-co-approval/index.ts` (line 222)**
- Error: `'error' is of type 'unknown'`
- Fix: Same `instanceof Error` pattern.

---

### Part B: Security Hardening

**1. Update `.gitignore`**
Add rules for environment files and secrets:
```
# Environment files
.env
.env.local
.env.*.local
.env.production
.env.development

# Secrets and keys
*.keystore
*.jks
```

**2. Create `.env.example`**
A safe template with placeholder values (no real keys):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
```

**Note on `.env` file**: The `.env` file is auto-managed by Lovable Cloud and cannot be removed or edited. The `.gitignore` addition ensures it won't be committed if the project is connected to GitHub. The anon key in `.env` is a publishable key (safe for client-side use) -- it is not a service role key.

**3. Edge Function JWT audit** -- already complete. All functions in `config.toml` have `verify_jwt = false` because they use the signing-keys approach and validate auth in code where needed. No service-role keys are exposed in client-side code (`client.ts` uses only the anon/publishable key).

---

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/check-missing-time-entries/index.ts` | Fix `unknown` error type |
| `supabase/functions/generate-wh347/index.ts` | Fix `Uint8Array` response body (2 locations) |
| `supabase/functions/process-co-signature/index.ts` | Fix `unknown` error type |
| `supabase/functions/quickbooks-fetch-journal-entries/index.ts` | Add QB config interface, fix type casting, fix function signature |
| `supabase/functions/quickbooks-void-bill/index.ts` | Ensure all paths return Response |
| `supabase/functions/send-co-approval/index.ts` | Fix `unknown` error type |
| `.gitignore` | Add env/secrets rules |

### Files to Create

| File | Purpose |
|------|---------|
| `.env.example` | Safe placeholder template |

