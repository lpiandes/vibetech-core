import { normalizeThemeColors } from "./theme";

export const lightTheme = {
  name: "light",
  colors: normalizeThemeColors({
    // Branding/status overrides for light customers can be added here.
  }),
} as const;

