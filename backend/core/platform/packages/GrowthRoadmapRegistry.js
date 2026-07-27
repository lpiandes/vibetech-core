/**
 * Phase 4 growth / marketing / ops products — roadmap until Product status.
 * Keeps honesty boundaries and target packageIds aligned with the pricing sheet.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { getSalesPackage } from "./SalesPackageCatalog.js";

export const GROWTH_ROADMAP_PACKAGE_IDS = deepFreeze([
  "website_native_chat",
  "social_content_automation",
  "marketing_content_engine",
  "sales_analytics",
  "document_processing",
  "reporting_automation",
  "crm_external_integration",
  "multi_system_integration",
]);

const BUILD_NOTES = deepFreeze({
  website_native_chat: {
    sheetLine: "Native Website Chatbot",
    build: "Real widget (not forms); retire website_chatbot soft-sell when shipped.",
    softSellToday: "website_chatbot",
  },
  social_content_automation: {
    sheetLine: "Social Media Content Automation",
    build: "Channel adapters + draft queue + approve.",
    softSellToday: null,
  },
  marketing_content_engine: {
    sheetLine: "Marketing Content Engine",
    build: "Brief → draft assets → approve publish.",
    softSellToday: null,
  },
  sales_analytics: {
    sheetLine: "Sales Analytics Dashboard",
    build: "Pipeline/conversion KPIs beyond Home metrics.",
    softSellToday: "growth_managed",
  },
  document_processing: {
    sheetLine: "Document Processing Automation",
    build: "Structured extract → Work/CRM beyond PDF→Knowledge.",
    softSellToday: "knowledge_assistant",
  },
  reporting_automation: {
    sheetLine: "Reporting and Dashboard Automation",
    build: "Scheduled reports + owner digest.",
    softSellToday: null,
  },
  crm_external_integration: {
    sheetLine: "External CRM Integration",
    build: "HubSpot/Salesforce sync (today CRM is in-platform only).",
    softSellToday: "crm_automation",
  },
  multi_system_integration: {
    sheetLine: "Multi-System Integration",
    build: "Expand live adapters past Google/Twilio/Meta.",
    softSellToday: "basic_integration",
  },
});

export function listGrowthRoadmapProducts() {
  return deepFreeze(
    GROWTH_ROADMAP_PACKAGE_IDS.map((id) => {
      const pkg = getSalesPackage(id);
      const note = BUILD_NOTES[id] ?? {};
      return {
        packageId: id,
        label: pkg?.label ?? id,
        sheetLine: note.sheetLine ?? pkg?.label ?? id,
        build: note.build ?? pkg?.honestyNote ?? "Roadmap.",
        softSellToday: note.softSellToday ?? null,
        commercialStatus: pkg?.commercialStatus ?? "roadmap",
        sellable: pkg?.sellable === true,
        honestyNote: pkg?.honestyNote ?? null,
        launchMissionIds: pkg?.launchMissionIds ?? [],
      };
    }),
  );
}

export function getGrowthRoadmapProduct(packageId) {
  const id = String(packageId ?? "").trim();
  return listGrowthRoadmapProducts().find((row) => row.packageId === id) ?? null;
}

export function assertGrowthProductsNotSellable() {
  return listGrowthRoadmapProducts().every((row) => row.sellable === false);
}
