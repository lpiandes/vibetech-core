# Media drop-in (Phase 3)

Interactive Why demos and testimonial story cards ship with **animated CSS mocks**.
When you have real clips, drop them in without redesigning the pages.

## How to enable videos

On any marketing page (before `marketing-interactive.js`), set:

```html
<script>
  window.VIBETECH_VIDEOS = {
    "why-consulting": "assets/videos/why-consulting.mp4",
    "why-builds": "assets/videos/why-builds.mp4",
    "why-automation": "assets/videos/why-automation.mp4",
    "why-reporting": "assets/videos/why-reporting.mp4",
    "why-security": "assets/videos/why-security.mp4",
    "why-support": "assets/videos/why-support.mp4",
    "story-kerry": "assets/videos/kerry.mp4",
    "story-donaldo": "assets/videos/donaldo.mp4",
    "story-rachel": "assets/videos/rachel.mp4",
    "story-michael": "assets/videos/michael.mp4",
    "story-john": "assets/videos/john.mp4",
    "story-randolph": "assets/videos/randolph.mp4",
    "story-danielle": "assets/videos/danielle.mp4"
  };
</script>
```

Upload the mp4 files under `public_html/assets/videos/` on Hostinger.
Each `[data-video-slot="…"]` host will show the `<video>` and hide the CSS demo stage.

## Customer photos

Story cards use letter avatars. To add a face later, replace `.story-avatar` text with:

```html
<img class="story-avatar" src="assets/clients/kerry.jpg" alt="" width="40" height="40" />
```

## Suggested clip length

30–60 seconds, muted-friendly, landscape or 16:9. Poster frames optional via the `poster` attribute on `<video>`.
