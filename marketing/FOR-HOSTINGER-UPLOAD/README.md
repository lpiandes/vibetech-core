# ROI qualifier + Social Checker drop-in (keeps existing site)

Do **not** replace the whole marketing site with `marketing/site/`.

Use these files on Hostinger:

| File | Action |
|------|--------|
| `index.with-roi.html` → upload as `index.html` | Homepage + Social Checker section + ROI |
| `roi-qualifier.css` | Styles for Social Checker + ROI widget |
| `roi-qualifier.js` | 3 questions → rate-card package + industry-avg ROI math |
| `privacy.html` + `terms.html` + `legal.css` | Privacy Policy & Terms (A2P / product coverage) — also link from footer |

Public URLs after upload: `https://vtechdevelopment.com/privacy.html` (or rewrite to `/privacy`) and `/terms.html`.

## Behavior

1. **Social Background Checker** section with CTA to `https://social.vtechdevelopment.com/`
2. Three questions (business × leak × today) → distinct package from the published rate card
3. Compare **our setup + monthly** vs **industry-average status-quo cost** (labor + leakage)
4. Full explanation + hypothetical + year-one ROI / payback
5. **Book a call** (mailto by default) with the estimate pre-filled

Optional Calendly: before `roi-qualifier.js`, add:

```html
<script>window.VIBETECH_BOOK_CALL_URL = "https://calendly.com/your-link";</script>
```

Vanity redirects (`AIOperatingSystem/`, `SocialChecker/`) can stay.

