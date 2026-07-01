import { COMPANY_EVENT_TYPES, SUPPORTED_COMPANY_EVENT_TYPES } from "./CompanyEventTypes.js";
import {
  applyKnowledgeArchived,
  applyKnowledgeCreated,
  applyKnowledgeRevisionCreated,
} from "../../knowledge/KnowledgeRepository.js";
import {
  applyCategoryArchived,
  applyCategoryCreated,
  applyCategoryReordered,
  applyCategoryUpdated,
} from "../../knowledge/categories/CategoryRepository.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;

  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }

  return Object.freeze(value);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") {
    throw new Error(`CompanyEventEngine: expected ${name} to be a string.`);
  }
}

function generateBizId(prefix, eventId) {
  const safe = String(eventId).replace(/[^a-zA-Z0-9]/g, "");
  return `${prefix}_${safe}`;
}

function isoToDateKey(iso) {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

export class CompanyEventEngine {
  constructor({ runtime } = {}) {
    if (!runtime) throw new Error("CompanyEventEngine requires runtime.");
    this.runtime = runtime;
  }

  apply(event) {
    if (!event || typeof event !== "object") {
      throw new Error("CompanyEventEngine: event must be an object.");
    }

    requireString(event.id, "event.id");
    requireString(event.timestamp, "event.timestamp");
    requireString(event.type, "event.type");
    requireString(event.source, "event.source");
    if (!isPlainObject(event.payload)) {
      throw new Error("CompanyEventEngine: event.payload must be an object.");
    }

    if (!SUPPORTED_COMPANY_EVENT_TYPES.includes(event.type)) {
      throw new Error(`CompanyEventEngine: Unsupported event type: ${event.type}`);
    }

    const prevState = this.runtime._state;
    const prevCompanyData = prevState.companyData;
    const prevKnowledgeRepository = prevState.knowledgeRepository;
    const prevKnowledgeCategories = prevState.knowledgeCategories;

    const isValidCategory = (categoryId) => {
      if (!Array.isArray(prevKnowledgeCategories?.items)) return false;
      return prevKnowledgeCategories.items.some((c) => c.id === categoryId && c.status !== "ARCHIVED");
    };

    let nextCompanyData = prevCompanyData;
    let nextCustomActivities =
      Array.isArray(prevState.customActivities) ? prevState.customActivities : [];
    let nextKnowledgeRepository = prevKnowledgeRepository;
    let nextKnowledgeCategories = prevKnowledgeCategories;

    switch (event.type) {
      case COMPANY_EVENT_TYPES.WEBSITE_INQUIRY_RECEIVED: {
        const {
          buyer,
          propertyId,
          message,
          submittedAtISO,
          priority,
          employeeName,
          queueVisible,
          draftResponseReady,
          responseTimeMinutes,
          inquiryId,
          status,
        } = event.payload;

        if (!isPlainObject(buyer)) throw new Error("WEBSITE_INQUIRY_RECEIVED: buyer required.");
        requireString(buyer.buyerId, "buyer.buyerId");
        requireString(buyer.name, "buyer.name");
        requireString(buyer.email, "buyer.email");
        requireString(buyer.phone, "buyer.phone");
        requireString(propertyId, "propertyId");
        requireString(message, "message");
        requireString(submittedAtISO, "submittedAtISO");
        requireString(employeeName, "employeeName");

        const normalizedPriority = priority ?? "Medium";
        if (!["High", "Medium", "Low"].includes(normalizedPriority)) {
          throw new Error("WEBSITE_INQUIRY_RECEIVED: priority must be High/Medium/Low.");
        }

        const nextBuyers = [...prevCompanyData.buyers];
        const buyerIdx = nextBuyers.findIndex((b) => b.buyerId === buyer.buyerId);
        if (buyerIdx === -1) {
          nextBuyers.push({
            buyerId: buyer.buyerId,
            name: buyer.name,
            email: buyer.email,
            phone: buyer.phone,
          });
        } else {
          nextBuyers[buyerIdx] = {
            ...nextBuyers[buyerIdx],
            name: buyer.name,
            email: buyer.email,
            phone: buyer.phone,
          };
        }

        const nextInquiries = [...prevCompanyData.inquiries];
        const nextInquiryId =
          inquiryId ?? generateBizId("inq", event.id);
        const inquiryExists = nextInquiries.some((i) => i.inquiryId === nextInquiryId);

        const nextInquiry = {
          inquiryId: nextInquiryId,
          buyerId: buyer.buyerId,
          propertyId,
          message,
          submittedAtISO,
          status: status ?? "Needs Review",
          priority: normalizedPriority,
          employeeName,
          createdTimeISO: event.timestamp,
          queueVisible: queueVisible ?? true,
          draftResponseReady: draftResponseReady ?? false,
          responseTimeMinutes,
        };

        if (inquiryExists) {
          // Replace existing inquiry deterministically.
          const idx = nextInquiries.findIndex((i) => i.inquiryId === nextInquiryId);
          nextInquiries[idx] = nextInquiry;
        } else {
          nextInquiries.push(nextInquiry);
        }

        nextCompanyData = {
          ...prevCompanyData,
          buyers: nextBuyers,
          inquiries: nextInquiries,
        };
        break;
      }

      case COMPANY_EVENT_TYPES.BUYER_CREATED: {
        const { buyer } = event.payload;
        if (!isPlainObject(buyer)) throw new Error("BUYER_CREATED: buyer required.");
        requireString(buyer.buyerId, "buyer.buyerId");
        requireString(buyer.name, "buyer.name");
        requireString(buyer.email, "buyer.email");
        requireString(buyer.phone, "buyer.phone");

        nextCompanyData = {
          ...prevCompanyData,
          buyers: [...prevCompanyData.buyers, buyer],
        };
        break;
      }

      case COMPANY_EVENT_TYPES.BUYER_UPDATED: {
        const { buyer } = event.payload;
        if (!isPlainObject(buyer)) throw new Error("BUYER_UPDATED: buyer required.");
        requireString(buyer.buyerId, "buyer.buyerId");

        const nextBuyers = [...prevCompanyData.buyers];
        const idx = nextBuyers.findIndex((b) => b.buyerId === buyer.buyerId);
        if (idx === -1) throw new Error("BUYER_UPDATED: buyer does not exist.");

        nextBuyers[idx] = {
          ...nextBuyers[idx],
          ...buyer,
        };
        nextCompanyData = { ...prevCompanyData, buyers: nextBuyers };
        break;
      }

      case COMPANY_EVENT_TYPES.WORK_CREATED: {
        const { inquiryId, responseTimeMinutes } = event.payload;
        requireString(inquiryId, "inquiryId");

        const nextInquiries = prevCompanyData.inquiries.map((i) => {
          if (i.inquiryId !== inquiryId) return i;
          return {
            ...i,
            draftResponseReady: true,
            status: i.status === "Completed" ? "Completed" : "Needs Review",
            queueVisible: true,
            responseTimeMinutes:
              typeof responseTimeMinutes === "number" ? responseTimeMinutes : i.responseTimeMinutes,
          };
        });

        nextCompanyData = { ...prevCompanyData, inquiries: nextInquiries };
        break;
      }

      case COMPANY_EVENT_TYPES.WORK_APPROVED: {
        const { inquiryId } = event.payload;
        requireString(inquiryId, "inquiryId");

        const nextInquiries = prevCompanyData.inquiries.map((i) => {
          if (i.inquiryId !== inquiryId) return i;
          return {
            ...i,
            status: "Approved",
            draftResponseReady: true,
            queueVisible: false,
          };
        });

        nextCompanyData = { ...prevCompanyData, inquiries: nextInquiries };
        break;
      }

      case COMPANY_EVENT_TYPES.WORK_REJECTED: {
        const { inquiryId } = event.payload;
        requireString(inquiryId, "inquiryId");

        const nextInquiries = prevCompanyData.inquiries.map((i) => {
          if (i.inquiryId !== inquiryId) return i;
          return {
            ...i,
            status: "Needs Review",
            draftResponseReady: true,
            queueVisible: true,
          };
        });

        nextCompanyData = { ...prevCompanyData, inquiries: nextInquiries };
        break;
      }

      case COMPANY_EVENT_TYPES.EMAIL_SENT: {
        const { inquiryId } = event.payload;
        requireString(inquiryId, "inquiryId");

        const nextInquiries = prevCompanyData.inquiries.map((i) => {
          if (i.inquiryId !== inquiryId) return i;
          return {
            ...i,
            status: "Approved",
            draftResponseReady: true,
            queueVisible: false,
          };
        });

        nextCompanyData = { ...prevCompanyData, inquiries: nextInquiries };
        break;
      }

      case COMPANY_EVENT_TYPES.KNOWLEDGE_CREATED: {
        nextKnowledgeRepository = applyKnowledgeCreated(prevKnowledgeRepository, event.payload, {
          isValidCategory,
        });
        break;
      }

      case COMPANY_EVENT_TYPES.KNOWLEDGE_REVISION_CREATED: {
        nextKnowledgeRepository = applyKnowledgeRevisionCreated(
          prevKnowledgeRepository,
          event.payload,
          { isValidCategory },
        );
        break;
      }

      case COMPANY_EVENT_TYPES.KNOWLEDGE_ARCHIVED: {
        nextKnowledgeRepository = applyKnowledgeArchived(prevKnowledgeRepository, event.payload);
        break;
      }

      case COMPANY_EVENT_TYPES.CATEGORY_CREATED: {
        nextKnowledgeCategories = applyCategoryCreated(prevKnowledgeCategories, event.payload);
        break;
      }

      case COMPANY_EVENT_TYPES.CATEGORY_UPDATED: {
        nextKnowledgeCategories = applyCategoryUpdated(prevKnowledgeCategories, event.payload);
        break;
      }

      case COMPANY_EVENT_TYPES.CATEGORY_ARCHIVED: {
        nextKnowledgeCategories = applyCategoryArchived(prevKnowledgeCategories, event.payload);
        break;
      }

      case COMPANY_EVENT_TYPES.CATEGORY_REORDERED: {
        nextKnowledgeCategories = applyCategoryReordered(prevKnowledgeCategories, event.payload);
        break;
      }

      case COMPANY_EVENT_TYPES.ACTIVITY_CREATED: {
        const { activity } = event.payload;
        if (!isPlainObject(activity)) {
          throw new Error("ACTIVITY_CREATED: activity object required.");
        }
        requireString(activity.timestampISO, "activity.timestampISO");
        requireString(activity.employee, "activity.employee");
        requireString(activity.action, "activity.action");
        requireString(activity.object, "activity.object");
        requireString(activity.status, "activity.status");

        nextCustomActivities = [
          ...nextCustomActivities,
          deepFreeze({ ...activity }),
        ];
        break;
      }

      default: {
        // Exhaustiveness guard.
        throw new Error(`CompanyEventEngine: Unhandled event type: ${event.type}`);
      }
    }

    const nextState = deepFreeze({
      ...prevState,
      companyData: nextCompanyData,
      customActivities: nextCustomActivities,
      knowledgeRepository: nextKnowledgeRepository,
      knowledgeCategories: nextKnowledgeCategories,
    });

    this.runtime._state = nextState;
    this.runtime._workQueue = deepFreeze(this.runtime._deriveWorkQueue());
    this.runtime._activities = deepFreeze(this.runtime._deriveActivities());
    this.runtime._metrics = deepFreeze(this.runtime._deriveMetrics());
  }
}

