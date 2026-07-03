import { normalizeThemeColors } from "./theme";

export const darkTheme = {
  name: "dark",
  colors: normalizeThemeColors({}),
} as const;

