# Theme System (foundation only)

This folder provides a **theme definition scaffold** for future customer branding.

## Design rules
- Themes never change layout or component logic.
- Themes only affect semantic token values (colors) and can extend with future token overrides.
- The current app already uses CSS variables (`--background`, `--foreground`, etc.) defined in `frontend/app/globals.css`.  
  Future customer themes should map semantic tokens to those variables or override them at the CSS-variable layer.

## Extending for new customers
1. Create a new theme file (e.g. `customerTheme.ts`) that provides overrides to `semanticColors`.
2. Keep semantic keys stable across all customers so screens remain portable.

## Future integration
This sprint does not wire themes into React. The theme layer is intentionally non-React and token-only.

