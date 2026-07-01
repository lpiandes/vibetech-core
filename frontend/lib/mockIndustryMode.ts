export type MockIndustryMode = "property" | "standard";

export function getMockIndustryMode(): MockIndustryMode {
  const envValue = process.env.NEXT_PUBLIC_MOCK_INDUSTRY_MODE;
  if (envValue === "property") return "property";
  if (envValue === "standard") return "standard";

  // Default to property to match the Property Interest Coordinator sprint demo.
  return "property";
}

export function isPropertyMode(): boolean {
  return getMockIndustryMode() === "property";
}

