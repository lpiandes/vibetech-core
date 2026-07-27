export type MockIndustryMode = "property" | "standard";

export function getMockIndustryMode(): MockIndustryMode {
  const envValue = process.env.NEXT_PUBLIC_MOCK_INDUSTRY_MODE;
  if (envValue === "property") return "property";
  if (envValue === "standard") return "standard";

  // Demo data must be explicitly selected; never let a legacy property demo
  // shape the default experience for a real business.
  return "standard";
}

export function isPropertyMode(): boolean {
  return getMockIndustryMode() === "property";
}
