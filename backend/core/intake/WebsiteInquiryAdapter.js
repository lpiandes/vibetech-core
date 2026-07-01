/**
 * WebsiteInquiryAdapter
 *
 * Local-only adapter that demonstrates how a website-submitted property inquiry
 * becomes a business event in the Company Workspace Runtime.
 *
 * IMPORTANT:
 * - This file does not modify runtime/generation/contracts/view adapters.
 * - It only validates + normalizes input, then publishes a business event.
 */

import { COMPANY_EVENT_TYPES } from "../company/events/CompanyEventTypes.js";
import { createCompanyEvent } from "../company/events/CompanyEvent.js";
import { EmployeeDispatcher } from "../dispatch/EmployeeDispatcher.js";

function requiredString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function requiredNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asISOTime(maybeISO) {
  if (!maybeISO) return null;
  const d = new Date(maybeISO);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function validateAndNormalize(payload) {
  const runtime = payload?.runtime;
  const inquiry = payload?.inquiry ?? {};
  const property = payload?.property ?? {};
  const companyContext = payload?.companyContext ?? {};

  const buyerName = requiredString(inquiry?.name);
  const buyerEmail = requiredString(inquiry?.email);
  const buyerPhone = requiredString(inquiry?.phone);
  const buyerMessage = requiredString(inquiry?.message);
  const submittedAtISO = asISOTime(inquiry?.submittedAt);

  const propertyId = requiredString(property?.propertyId);

  const companyName = requiredString(companyContext?.companyName);
  const officeName = requiredString(companyContext?.officeName);
  const responsePolicy = requiredString(companyContext?.responsePolicy);

  const missing = [];
  if (!runtime) missing.push("runtime");
  if (!buyerName) missing.push("inquiry.name");
  if (!buyerEmail) missing.push("inquiry.email");
  if (!buyerPhone) missing.push("inquiry.phone");
  if (!buyerMessage) missing.push("inquiry.message");
  if (!submittedAtISO) missing.push("inquiry.submittedAt (valid ISO)");
  if (!propertyId) missing.push("property.propertyId");
  if (!companyName) missing.push("companyContext.companyName");
  if (!officeName) missing.push("companyContext.officeName");
  if (!responsePolicy) missing.push("companyContext.responsePolicy");

  if (missing.length) {
    const err = new Error(`WebsiteInquiryAdapter validation failed: ${missing.join(", ")}`);
    err.code = "VALIDATION_ERROR";
    err.missing = missing;
    throw err;
  }

  return {
    runtime,
    inquiry: {
      buyerId: inquiry?.buyerId ?? `buyer_web_${buyerName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      name: buyerName,
      email: buyerEmail,
      phone: buyerPhone,
      message: buyerMessage,
      submittedAtISO,
      priority: inquiry?.priority ?? "High",
      responseTimeMinutes: inquiry?.responseTimeMinutes ?? 32,
    },
    property: { propertyId },
    companyContext: { companyName, officeName, responsePolicy },
  };
}

export class WebsiteInquiryAdapter {
  async intake(payload) {
    const normalized = validateAndNormalize(payload);
    const runtime = normalized.runtime;

    const eventPayload = {
      buyer: {
        buyerId: normalized.inquiry.buyerId,
        name: normalized.inquiry.name,
        email: normalized.inquiry.email,
        phone: normalized.inquiry.phone,
      },
      propertyId: normalized.property.propertyId,
      message: normalized.inquiry.message,
      submittedAtISO: normalized.inquiry.submittedAtISO,
      priority: normalized.inquiry.priority,
      employeeName: "Property Interest Coordinator",
      queueVisible: true,
      draftResponseReady: true,
      responseTimeMinutes: normalized.inquiry.responseTimeMinutes,
      status: "Needs Review",
      companyContext: {
        companyName: normalized.companyContext.companyName,
        officeName: normalized.companyContext.officeName,
        responsePolicy: normalized.companyContext.responsePolicy,
      },
    };

    const event = createCompanyEvent({
      type: COMPANY_EVENT_TYPES.WEBSITE_INQUIRY_RECEIVED,
      source: "website",
      timestampISO: normalized.inquiry.submittedAtISO,
      payload: eventPayload,
    });

    runtime.applyEvent(event);

    const dispatcher = new EmployeeDispatcher({ runtime });
    const dispatchResult = await dispatcher.dispatch(event);

    return {
      success: true,
      eventId: event.id,
      assignedEmployee: dispatchResult.assignedEmployee,
      employeeSummary: dispatchResult.employeeSummary,
      reviewWork: dispatchResult.reviewWork,
    };
  }
}

