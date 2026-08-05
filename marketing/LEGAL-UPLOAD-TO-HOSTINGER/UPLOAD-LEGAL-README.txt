# Upload these 4 files to Hostinger (public_html of vtechdevelopment.com)

## Files
1. `privacy.html` — Privacy Policy (covers marketing + app + social)
2. `terms.html` — Terms of Service
3. `legal.css` — Shared styles (must sit next to the HTML files)
4. `htaccess-legal-snippet.txt` — optional pretty URLs (`/privacy` and `/terms`)

## After upload, open
- https://vtechdevelopment.com/privacy.html
- https://vtechdevelopment.com/terms.html

If you add the htaccess rules (or rename snippet into your existing `.htaccess`):
- https://vtechdevelopment.com/privacy
- https://vtechdevelopment.com/terms

## Also update your homepage footer
Link **Privacy** → `privacy.html` and **Terms** → `terms.html`
(already wired in the repo `index.html` drop-in).

## A2P / SMS
Use these exact URLs in Twilio Brand / campaign and in-app SMS setup:
- https://vtechdevelopment.com/privacy.html
- https://vtechdevelopment.com/terms.html

(Or the pretty `/privacy` `/terms` URLs once redirects work.)

## Important
These are strong business drafts tailored to VibeTech’s three sites and products.
Have a lawyer review before treating them as final legal advice.
