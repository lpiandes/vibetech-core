import type { SemanticColorKey } from "../tokens/colors";
import { semanticColors } from "../tokens/colors";

export type ThemeColors = Record<SemanticColorKey, string>;

export type Theme = {
  name: string;
  colors: ThemeColors;
};

export function normalizeThemeColors(colors: Partial<ThemeColors> = {}): ThemeColors {
  const out = { ...semanticColors, ...colors } as ThemeColors;
  return out;
}

