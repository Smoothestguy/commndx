## Plan: restore the live website display

1. **Confirm the failure mode**
   - Test the published custom domain and the Lovable preview with a browser-level render check, not just HTTP/HTML.
   - Capture any runtime console errors, failed JS/CSS requests, or blank-screen symptoms.

2. **Identify the source of the black screen**
   - Inspect the app entry, auth route, routing guards, global styles, and any recent navigation/security-related changes that could render a dark empty page.
   - Check whether the domain is serving valid HTML but failing after JavaScript loads, which matches the screenshot.

3. **Apply the smallest targeted fix**
   - If this is a frontend runtime/render issue, patch only the component/hook/style causing the blank render.
   - If this is a deployment/cache issue, avoid code changes and use the appropriate restart/republish path.
   - If this is backend/auth availability causing the app to hang, verify Lovable Cloud health before changing app code.

4. **Verify success**
   - Run a fresh browser render check against `https://fairfieldrg.com` and the preview URL.
   - Confirm visible auth UI appears instead of a black screen.
   - Check console/network output for remaining blocking errors.