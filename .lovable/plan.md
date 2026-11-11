# Content-specific public link previews

## Confirmed problem
- `fairfieldrg.com/j/...` returns the same Command X HTML as the homepage to Facebook crawlers.
- A job-preview service already exists, but the ordinary job **Copy** button and QR code bypass it. Its social URL also identifies the destination as the application page instead of the share page, and it lacks a job-specific image.
- Current Lovable hosting cannot route `/j/...` or other dedicated paths to an edge function. Adding a React route or a redirects configuration file will not fix crawler previews.

## Hosting decision required
**Recommended for the requested edge-function design:** use a configurable reverse proxy on the domain to route only dedicated share paths to the preview service; leave the application unchanged. This requires access to the domain's proxy configuration, which is not currently available here. Do not change DNS or live links until this route is available and verified.

**Alternative:** approve upgrading to Lovable's server-rendered template, which supports same-domain server responses without an external proxy. This changes the app framework and needs a separate upgrade approval; it will not be started silently.

## Implementation once routing is available
1. Add one public preview service for jobs, project/location registration, kiosk and agency hiring links. Validate link scope and expiry before exposing any context. Closed or invalid links get neutral unavailable cards.
2. Keep punch cards generic and signature cards exactly **Signature requested — Fairfield Response Group**. Never query signer/person records for those cards or include identity, phone numbers, money or private document details.
3. Jobs show title, public location, public role/shift/start-date facts; omit pay by default, permitting only explicitly public advertised pay if needed. Generate a bounded 1200×630 branded raster card with title, location and **Apply now**, using a static template. Do not publish private job descriptions or internal notes.
4. Centralize copy, share, QR and SMS links across the application and sending functions. Preserve existing tokens, agency attribution, language and kiosk mode. Keep the destination registration/punch/signing behavior and authorization unchanged.
5. Serve crawler HTML with matching OG/Twitter fields and self-referencing share URLs; redirect human browsers only to fixed, allow-listed Fairfield destinations. Use cache-safe responses so crawler/human variants never collide. Never log bearer links.

## Verification
- Fetch real open-job and public-form share URLs using Facebook and Apple/iMessage user agents; inspect the returned HTML without JavaScript.
- Verify generated cards load and include only approved public content.
- Open the same URLs in a browser and confirm the intended posting/form and preserved parameters.
- Test generic punch/sign metadata with synthetic tokens and assert no personal or financial fields leak.
- Run focused policy tests and check preview errors. No SMS, owner-data changes or hygiene jobs; remove any temporary verification records.

## Technical details
- Keep record lookup and card generation server-side, with minimal allow-listed projections and no anonymous table grants.
- Share-path routing is the blocker, not metadata generation. The existing direct function URL is not a Fairfield-domain share path and will not be substituted everywhere as though it were.