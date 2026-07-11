/**
 * Backend-owned campaign template service singleton for scripts and Node tests.
 * Next.js must use frontend/lib/server/compose.ts instead.
 */
import { platformStore } from "../persistence/platformStore.js";
import {
  BusinessCampaignTemplateService,
  createBusinessCampaignTemplateService,
} from "./BusinessCampaignTemplateService.js";

export const businessCampaignTemplateService = createBusinessCampaignTemplateService({
  store: platformStore,
});

export { BusinessCampaignTemplateService, createBusinessCampaignTemplateService };
