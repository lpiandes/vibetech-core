/**
 * CompanyWorkspaceRuntime
 *
 * SSOT for the Company Workspace UI.
 *
 * Constraints:
 * - In-memory only
 * - Deterministic business objects
 * - No network calls
 * - No APIs
 * - No provider/runtime pipeline changes
 */

import { CompanyEventEngine } from "./events/CompanyEventEngine.js";
import { COMPANY_EVENT_TYPES } from "./events/CompanyEventTypes.js";
import { createCompanyEvent } from "./events/CompanyEvent.js";
import {
  createKnowledgeRepository,
} from "../knowledge/KnowledgeRepository.js";
import { deriveCompactKnowledgeFromRepository } from "../knowledge/deriveCompactKnowledgeFromRepository.js";
import { createBuiltInKnowledgeCategories } from "../knowledge/categories/builtInCategories.js";
import { createCategoryRepository } from "../knowledge/categories/CategoryRepository.js";
import { CompanyProfileBuilder } from "./profile/CompanyProfileBuilder.js";
import { createCompanyProfile } from "./profile/CompanyProfile.js";
import { BusinessProfileBuilder } from "./business-profile/BusinessProfileBuilder.js";
import { CommunicationSetupBuilder } from "./communication-setup/CommunicationSetupBuilder.js";
import { ConnectedSystemBuilder } from "./connected-systems/ConnectedSystemBuilder.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;

  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }

  return Object.freeze(value);
}

function isoToDateKey(iso) {
  // Stable day key in UTC for deterministic “today” metrics.
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

function minutesToMs(min) {
  return min * 60 * 1000;
}

function addMsToISO(iso, ms) {
  const d = new Date(iso);
  return new Date(d.getTime() + ms).toISOString();
}

/**
 * @typedef {object} CompanyIdentity
 * @property {string} companyName
 * @property {string=} officeName
 * @property {string} industry
 */

/**
 * @typedef {object} CompanyEmployee
 * @property {string} employeeId
 * @property {string} employeeName
 * @property {string} role
 * @property {string} mission
 * @property {"Working"|"Needs Review"|"Approved"|"Completed"|"Offline"} status
 * @property {string} statusQualifier
 * @property {number} todayCompletedCount
 * @property {string} todayAccomplishmentLine
 * @property {number} approvalRatePercent
 * @property {string} approvalRateFootnote
 * @property {{inProgressCount:number, waitingOnYouCount:number}} currentWorkload
 * @property {string[]} capabilities
 * @property {string} primaryActionLabel
 * @property {number=} hoursSavedPerCompletedTask
 */

/**
 * @typedef {object} CompanyData
 * @property {Array<{propertyId:string,address:string,city:string,state:string,price:number,description:string,highlights:string[],considerations:string[]}>} properties
 * @property {Array<{buyerId:string,name:string,email:string,phone:string}>} buyers
 * @property {Array<{
 *   inquiryId:string,
 *   buyerId:string,
 *   propertyId:string,
 *   message:string,
 *   submittedAtISO:string,
 *   status:"Needs Review"|"Approved"|"Completed",
 *   priority:"High"|"Medium"|"Low",
 *   employeeName:string,
 *   createdTimeISO:string,
 *   queueVisible:boolean,
 *   draftResponseReady:boolean,
 *   responseTimeMinutes?:number
 * }>} inquiries
 */

/**
 * @typedef {object} CompanyKnowledge
 * @property {Array<{question:string,answer:string}>} faqs
 * @property {string[]} listingPolicies
 * @property {string[]} responsePreferences
 * @property {string} brandVoice
 * @property {string[]} propertyShowingRules
 */

/**
 * @typedef {object} CompanyIntegration
 * @property {string} type
 * @property {boolean} connected
 * @property {string=} vendor
 */

/**
 * @typedef {object} CompanyApprovalRule
 * @property {string} ruleType
 * @property {boolean} enabled
 * @property {string} description
 */

import { buildEmptyCompanySeed } from "./buildEmptyCompanySeed.js";
import { createABCPropertyGroupSeed } from "./fixtures/ABCPropertyGroupSeed.js";

export { createABCPropertyGroupSeed };


export class CompanyWorkspaceRuntime {
  constructor({ seed = buildEmptyCompanySeed } = {}) {
    this._state = seed();
    // Derived caches (still immutable) for determinism.
    this._workQueue = deepFreeze(this._deriveWorkQueue());
    this._activities = deepFreeze(this._deriveActivities());
    this._metrics = deepFreeze(this._deriveMetrics());
  }

  getCompany() {
    return this._state.identity;
  }

  getEmployees() {
    return this._state.employees;
  }

  getCompanyData() {
    return this._state.companyData;
  }

  getCompanyProfile() {
    return this._state.companyProfile;
  }

  getBusinessProfile() {
    return this._state.businessProfile;
  }

  getCommunicationSetup() {
    return this._state.communicationSetup;
  }

  getConnectedSystems() {
    return this._state.connectedSystems;
  }

  getKnowledge() {
    return deriveCompactKnowledgeFromRepository(this._state.knowledgeRepository);
  }

  getKnowledgeRepository() {
    return this._state.knowledgeRepository;
  }

  getKnowledgeCategories() {
    return this._state.knowledgeCategories;
  }

  createKnowledgeItem(knowledgeInput) {
    const event = createCompanyEvent({
      id: knowledgeInput?.id ? `kn_evt_${knowledgeInput.id}` : undefined,
      timestampISO: new Date().toISOString(),
      type: COMPANY_EVENT_TYPES.KNOWLEDGE_CREATED,
      source: "runtime:createKnowledgeItem",
      payload: knowledgeInput,
    });
    this.applyEvent(event);
    return this.getKnowledgeRepository();
  }

  reviseKnowledgeItem(knowledgeId, revisionPatch) {
    const payload = {
      id: knowledgeId,
      ...revisionPatch,
      updatedAt: revisionPatch?.updatedAt ?? new Date().toISOString(),
      updatedBy: revisionPatch?.updatedBy ?? "runtime:reviseKnowledgeItem",
    };

    const event = createCompanyEvent({
      id: `kn_evt_rev_${knowledgeId}_${Date.now()}`,
      timestampISO: new Date().toISOString(),
      type: COMPANY_EVENT_TYPES.KNOWLEDGE_REVISION_CREATED,
      source: "runtime:reviseKnowledgeItem",
      payload,
    });

    this.applyEvent(event);
    return this.getKnowledgeRepository();
  }

  archiveKnowledgeItem(knowledgeId, opts = {}) {
    const event = createCompanyEvent({
      id: `kn_evt_arch_${knowledgeId}_${Date.now()}`,
      timestampISO: new Date().toISOString(),
      type: COMPANY_EVENT_TYPES.KNOWLEDGE_ARCHIVED,
      source: "runtime:archiveKnowledgeItem",
      payload: {
        id: knowledgeId,
        updatedAt: opts.updatedAt ?? new Date().toISOString(),
        updatedBy: opts.updatedBy ?? "runtime:archiveKnowledgeItem",
      },
    });

    this.applyEvent(event);
    return this.getKnowledgeRepository();
  }

  getIntegrations() {
    return this._state.integrations;
  }

  getApprovalRules() {
    return this._state.approvalRules;
  }

  getWorkQueue() {
    return this._workQueue;
  }

  getActivities() {
    return this._activities;
  }

  getMetrics() {
    return this._metrics;
  }

  /**
   * First-class outbound communications created via CommunicationEngine.
   * @returns {Array<any>}
   */
  getCommunications() {
    return this._state.communications;
  }

  _deriveWorkQueue() {
    const { buyers, properties, inquiries } = this._state.companyData;

    const buyerById = new Map(buyers.map((b) => [b.buyerId, b]));
    const propertyById = new Map(properties.map((p) => [p.propertyId, p]));

    /** @type {Array<{workItemId:string,title:string,clientName:string,matterType:string,priority:"High"|"Medium"|"Low",status:"Needs Review"|"Approved"|"Completed",assignedEmployeeName:string,createdTimeISO:string}>} */
    const items = inquiries
      .filter((i) => i.queueVisible)
      .map((i) => {
        const buyer = buyerById.get(i.buyerId);
        const property = propertyById.get(i.propertyId);

        const propertyLabel = property
          ? `${property.address} (${property.city}, ${property.state})`
          : "Property";

        return {
          workItemId: i.inquiryId,
          title: i.draftResponseReady ? "Draft response" : "Draft in progress",
          clientName: buyer?.name ?? "Buyer",
          matterType: propertyLabel,
          priority: i.priority,
          status: i.status,
          assignedEmployeeName: i.employeeName,
          createdTimeISO: i.createdTimeISO,
        };
      });

    // Deterministic ordering: newest first by createdTimeISO.
    items.sort(
      (a, b) => new Date(b.createdTimeISO).getTime() - new Date(a.createdTimeISO).getTime(),
    );

    return items;
  }

  _deriveActivities() {
    const { buyers, properties, inquiries } = this._state.companyData;
    const buyerById = new Map(buyers.map((b) => [b.buyerId, b]));
    const propertyById = new Map(properties.map((p) => [p.propertyId, p]));

    /** @type {Array<{timestampISO:string, employee:string, action:string, object:string, status:string}>} */
    const activities = [];

    const customActivities = Array.isArray(this._state.customActivities)
      ? this._state.customActivities
      : [];
    activities.push(...customActivities);

    for (const inquiry of inquiries) {
      const buyer = buyerById.get(inquiry.buyerId);
      const property = propertyById.get(inquiry.propertyId);
      const employee = inquiry.employeeName;

      const objectLabel = property
        ? property.address
        : "Property";

      activities.push({
        timestampISO: inquiry.submittedAtISO,
        employee,
        action: "Received Inquiry",
        object: buyer?.name ?? "Buyer",
        status: "Recorded",
      });

      activities.push({
        timestampISO: inquiry.createdTimeISO,
        employee,
        action: "Reviewed Property",
        object: objectLabel,
        status: "Reviewed",
      });

      if (inquiry.draftResponseReady) {
        activities.push({
          timestampISO: addMsToISO(inquiry.createdTimeISO, minutesToMs(1)),
          employee,
          action: "Prepared Draft",
          object: objectLabel,
          status: "Ready for review",
        });
      }

      if (inquiry.status === "Needs Review" && inquiry.draftResponseReady) {
        activities.push({
          timestampISO: addMsToISO(inquiry.createdTimeISO, minutesToMs(2)),
          employee,
          action: "Waiting For Approval",
          object: objectLabel,
          status: "Pending governance",
        });
      }

      if (inquiry.status === "Approved") {
        activities.push({
          timestampISO: addMsToISO(inquiry.createdTimeISO, minutesToMs(2)),
          employee,
          action: "Approved",
          object: objectLabel,
          status: "Approved",
        });

        activities.push({
          timestampISO: addMsToISO(inquiry.createdTimeISO, minutesToMs(3)),
          employee,
          action: "Email Sent",
          object: buyer?.name ?? "Buyer",
          status: "Delivered",
        });
      }

      if (inquiry.status === "Completed") {
        activities.push({
          timestampISO: addMsToISO(inquiry.createdTimeISO, minutesToMs(2)),
          employee,
          action: "Completed",
          object: objectLabel,
          status: "Done",
        });
      }
    }

    activities.sort(
      (a, b) => new Date(b.timestampISO).getTime() - new Date(a.timestampISO).getTime(),
    );

    return activities;
  }

  _deriveMetrics() {
    const { inquiries } = this._state.companyData;
    const employees = this._state.employees;

    const dayKey = (() => {
      const sorted = [...inquiries].sort(
        (a, b) => new Date(b.createdTimeISO).getTime() - new Date(a.createdTimeISO).getTime(),
      );
      return isoToDateKey(sorted[0]?.createdTimeISO ?? new Date().toISOString());
    })();

    const pendingReviews = inquiries.filter(
      (i) => i.status === "Needs Review" && i.draftResponseReady,
    ).length;

    const completedToday = inquiries.filter((i) => {
      const key = isoToDateKey(i.createdTimeISO);
      return key === dayKey && (i.status === "Approved" || i.status === "Completed");
    }).length;

    const activeEmployees = employees.filter(
      (e) => e.status === "Working" || e.status === "Needs Review",
    ).length;

    const hoursSavedToday = employees.reduce((sum, e) => {
      const rate = typeof e.hoursSavedPerCompletedTask === "number"
        ? e.hoursSavedPerCompletedTask
        : 0;
      return sum + e.todayCompletedCount * rate;
    }, 0);

    return {
      pendingReviews,
      completedToday,
      hoursSavedToday,
      activeEmployees,
    };
  }

  applyEvent(event) {
    // Delegation is the only permitted runtime mutation path.
    const engine = new CompanyEventEngine({ runtime: this });
    engine.apply(event);
  }
}

