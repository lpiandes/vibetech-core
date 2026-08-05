# Interactive marketing pack (Hostinger)

Upload these into `public_html` (replace matching files). Keep existing `styles.css`, `script.js`, `assets/`, and `products.html` on the server.

## Must upload

| File | Purpose |
|------|---------|
| `index.html` | Homepage — ROI assessment as hero |
| `why.html` | Interactive Why VibeTech (6 sections + demo mocks) |
| `testimonials.html` | Interactive story cards (+ Mateo & Jean quotes) |
| `roi-qualifier.js` / `roi-qualifier.css` | 4-question ROI + BLS $20.59 math |
| `marketing-interactive.js` / `.css` | Why accordion + story walkthroughs + video slots |
| `marketing-consultant.js` / `.css` | Floating AI consultant / Build my AI plan |
| `privacy.html` / `terms.html` / `legal.css` | Legal pages |
| `MEDIA-DROPIN.md` | How to attach videos later |

## Behavior

1. **Homepage hero** — “What is AI costing your business?” 4 questions (team → org → pain → current state).
2. Math: headcount midpoint × hours/person/week × 4.33 × **$20.59** × recovery % vs rate card → net / year-one ROI / payback. Modeled-estimate disclaimer.
3. Answers saved in `sessionStorage` (`vt.roi.assessment.v2`) for the consultant.
4. **Why / Testimonials** — interactive panels; CSS demos until `window.VIBETECH_VIDEOS` is set (see MEDIA-DROPIN.md).
5. **AI consultant** — sticky button + header CTAs call `https://app.vtechdevelopment.com/api/marketing/consultant` and meeting requests email Leo / Brett / Cary.

## After upload

Hard-refresh (`Cmd+Shift+R`). Deploy the app (`vercel --prod`) so the marketing API routes are live before relying on the chat widget.
