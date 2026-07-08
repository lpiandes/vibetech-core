import {
  createKnowledgeRepository,
} from "../knowledge/KnowledgeRepository.js";
import { createBuiltInKnowledgeCategories } from "../knowledge/categories/builtInCategories.js";
import { createCategoryRepository } from "../knowledge/categories/CategoryRepository.js";
import { CompanyProfileBuilder } from "./profile/CompanyProfileBuilder.js";
import { createCompanyProfile } from "./profile/CompanyProfile.js";
import { BusinessProfileBuilder } from "./business-profile/BusinessProfileBuilder.js";
import { CommunicationSetupBuilder } from "./communication-setup/CommunicationSetupBuilder.js";
import { ConnectedSystemBuilder } from "./connected-systems/ConnectedSystemBuilder.js";
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

const DEFAULT_NOW_ISO = "2026-07-01T00:00:00.000Z";

/**
 * Canonical empty company seed for normal business workspaces.
 * Package installation may add capability definitions and templates — not business facts.
 */
export function buildEmptyCompanySeed({
  companyName = "New Business",
  officeName = null,
  industry = "General",
  nowISO = DEFAULT_NOW_ISO,
} = {}) {
  const identity = {
    companyName: String(companyName),
    officeName: officeName ? String(officeName) : undefined,
    industry: String(industry),
  };

  const companyData = {
    properties: [],
    buyers: [],
    inquiries: [],
  };

  const companyProfile = createCompanyProfile(
    CompanyProfileBuilder.build({
      identity,
      profileOverrides: {
        metadata: {
          createdAtISO: nowISO,
          updatedAtISO: nowISO,
          version: 1,
        },
      },
    }),
  );

  const businessProfile = BusinessProfileBuilder.build({
    companyProfile,
    overrides: { metadata: { createdAtISO: nowISO, updatedAtISO: nowISO, version: 1 } },
    nowISO,
  });

  const knowledgeCategories = createCategoryRepository({
    items: createBuiltInKnowledgeCategories(),
  });

  const knowledgeRepository = createKnowledgeRepository({ items: [] });

  const integrations = [
    { type: "website", connected: false },
    { type: "email", connected: false },
    { type: "crm", connected: false },
  ];

  const approvalRules = [];

  const communicationSetup = CommunicationSetupBuilder.build({
    companyProfile,
    businessProfile,
    approvalRules,
    nowISO,
  });

  const connectedSystems = ConnectedSystemBuilder.buildSnapshot({
    integrations,
    knowledgeRepository,
    knowledgeCategories,
  });

  return deepFreeze({
    identity,
    employees: [],
    companyData,
    companyProfile,
    businessProfile,
    communicationSetup,
    connectedSystems,
    knowledgeRepository,
    knowledgeCategories,
    integrations,
    approvalRules,
    communications: [],
    customActivities: [],
  });
}
