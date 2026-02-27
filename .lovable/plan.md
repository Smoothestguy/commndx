

## Plan: AI Mapping Advisor for QuickBooks

### Overview
Add an "AI Mapping Advisor" button to the Sync Mappings Overview card that gathers all mapping data (counts + sample unmapped records) and sends it to Lovable AI for analysis using the detailed system prompt provided.

### Files to Create/Edit

| File | Change |
|------|--------|
| `supabase/functions/quickbooks-mapping-advisor/index.ts` | New edge function |
| `src/components/quickbooks/MappingAdvisor.tsx` | New UI component (Dialog) |
| `src/pages/QuickBooksSettings.tsx` | Add advisor button to SyncMappingsOverview header |
| `supabase/config.toml` | Add function config (auto-managed) |

### Edge Function: `quickbooks-mapping-advisor`
- Queries all 7 entity tables + mapping tables to get counts
- Fetches up to 20 sample unmapped records per entity with key fields (amount, status, date, name)
- Sends the full context to Lovable AI (`google/gemini-2.5-flash`) with the user's system prompt (tax-aware accounting advisor)
- Uses tool calling to extract structured JSON output matching the schema (summary, entity_overview, critical_items, recommendations, warnings)
- Returns structured JSON to the client

### Component: `MappingAdvisor.tsx`
- Dialog triggered by a "Sparkles" button in the SyncMappingsOverview card header
- Loading state with progress message while AI analyzes
- Renders AI response in sections:
  - **Summary** — high-level risk overview
  - **Critical Items** — cards with priority badges (high/medium/low), impact amounts, root causes, and next actions
  - **Recommendations** — ordered steps with rationale and risk-if-ignored
  - **Warnings** — color-coded alerts (tax, accounting, data, permissions)
- Error handling for 429/402 rate limit responses with user-friendly messages

### Integration in QuickBooksSettings
- Add Sparkles icon button next to "Sync Mappings Overview" title
- Opens the MappingAdvisor dialog
- No new state needed beyond the dialog's internal open/close

