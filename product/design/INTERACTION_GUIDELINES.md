# Interaction Guidelines

Defines how the UI should feel when users interact with it (hover, focus, empty, loading, transitions).

No code. No implementation details. Only the expected visual behavior.

## Hover behavior

- Cards should have subtle elevation:
  - Slight upward motion on hover (small negative translate).
  - Shadow increases gently to communicate interactivity.
- Buttons should respond with calm contrast changes:
  - Primary CTA: slight brightness or background emphasis.
  - Secondary CTA: mild background tint.

Hover must remain premium:
- Avoid noisy animations.
- Avoid strong color flashes.

## Focus behavior

- Keyboard focus must be visible and consistent.
- Use a ring/focus outline treatment that matches the design language:
  - Slightly offset ring
  - High enough contrast to see on light backgrounds
- Focus should never be clipped or hidden inside cards.

## Loading states

- Use calm skeletons or placeholders with consistent spacing.
- Prefer “layout-stable” loaders to avoid content jumps.
- Do not show spinners that compete with the primary CTA.

## Empty states

- Empty states should feel reassuring, not broken.
- Include:
  - an icon
  - a human title
  - a short description
  - optional action (if one exists)

## Transitions

- Use short, smooth transitions:
  - duration: ~200ms
  - easing: gentle (ease-out) so interactions feel responsive and premium.
- Transitions should not alter meaning—only communicate interactivity.

## Motion philosophy

- Motion is for:
  - feedback
  - affordance
  - hierarchy of attention
- Motion is not decoration.
- Keep motion minimal to maintain “calm governance” UX.

