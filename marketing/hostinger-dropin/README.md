# ROI qualifier drop-in (keeps existing site)

Do **not** replace the whole marketing site with `marketing/site/`.

Use these files to restore the original homepage and add a 3-question ROI check:

| File | Action |
|------|--------|
| `index.with-roi.html` → upload as `index.html` | Your original homepage + ROI section |
| `roi-qualifier.css` | Styles for the widget |
| `roi-qualifier.js` | 3 questions → recommendation + ROI → book a call |

## Behavior

1. Three broad multiple-choice questions  
2. Recommends a starting package  
3. Shows estimated monthly drag + upside  
4. **Book a call** (mailto by default)

Optional Calendly: before `roi-qualifier.js`, add:

```html
<script>window.VIBETECH_BOOK_CALL_URL = "https://calendly.com/your-link";</script>
```

Vanity redirects (`AIOperatingSystem/`, `SocialChecker/`) can stay.
