/**
 * WebsiteInquiryAdapter
 *
 * Local-only adapter that demonstrates how a website-submitted property inquiry
 * can enter VIBETech and be delegated into the existing Property Interest Coordinator.
 *
 * IMPORTANT:
 * - This file does not modify runtime/generation/contracts/view adapters.
 * - It only validates + normalizes input, then calls the employee.
 */

import { PropertyInterestCoordinator } from "../employees/property-interest-coordinator/PropertyInterestCoordinator.js";

function requiredString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function requiredNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asISOTime(submittedAt) {
  if (!submittedAt) return new Date().toISOString();
  const d = new Date(submittedAt);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function validateAndNormalize(payload) {
  const inquiry = payload?.inquiry ?? {};
  const property = payload?.property ?? {};
  const companyContext = payload?.companyContext ?? {};

  const buyerName = requiredString(inquiry?.name);
  const buyerEmail = requiredString(inquiry?.email);
  const buyerPhone = requiredString(inquiry?.phone);
  const buyerMessage = requiredString(inquiry?.message);
  const submittedAtISO = asISOTime(inquiry?.submittedAt);

  const propertyId = requiredString(property?.propertyId);
  const address = requiredString(property?.address);
  const city = requiredString(property?.city);
  const state = requiredString(property?.state);
  const price =
    typeof property?.price === "string"
      ? Number(property.price)
      : property?.price;
  const priceNumber = requiredNumber(price);

  const description = requiredString(property?.description);
  const highlights = Array.isArray(property?.highlights) ? property.highlights.map(String) : [];
  const considerations = Array.isArray(property?.considerations)
    ? property.considerations.map(String)
    : [];

  const companyName = requiredString(companyContext?.companyName);
  const officeName = requiredString(companyContext?.officeName);
  const responsePolicy = requiredString(companyContext?.responsePolicy);

  const missing = [];
  if (!buyerName) missing.push("inquiry.name");
  if (!buyerEmail) missing.push("inquiry.email");
  if (!buyerPhone) missing.push("inquiry.phone");
  if (!buyerMessage) missing.push("inquiry.message");
  if (!propertyId) missing.push("property.propertyId");
  if (!address) missing.push("property.address");
  if (!city) missing.push("property.city");
  if (!state) missing.push("property.state");
  if (priceNumber === null) missing.push("property.price (number)");
  if (!description) missing.push("property.description");
  if (!companyName) missing.push("companyContext.companyName");
  if (!officeName) missing.push("companyContext.officeName");
  if (!responsePolicy) missing.push("companyContext.responsePolicy");

  if (missing.length) {
    const err = new Error(`WebsiteInquiryAdapter validation failed: ${missing.join(", ")}`);
    err.code = "VALIDATION_ERROR";
    err.missing = missing;
    throw err;
  }

  // Normalize into the employee’s stable input contract.
  return {
    inquiry: {
      name: buyerName,
      email: buyerEmail,
      phone: buyerPhone,
      message: buyerMessage,
      submittedAt: submittedAtISO,
    },
    property: {
      propertyId,
      address,
      city,
      state,
      price: priceNumber,
      description,
      highlights,
      considerations,
    },
    companyContext: {
      companyName,
      officeName,
      responsePolicy,
    },
  };
}

export class WebsiteInquiryAdapter {
  constructor({ coordinator } = {}) {
    this.coordinator = coordinator ?? new PropertyInterestCoordinator();
  }

  async intake(payload) {
    const normalized = validateAndNormalize(payload);

    const result = await this.coordinator.run(normalized);

    return {
      employeeSummary: result?.employeeSummary,
      reviewWork: result?.reviewWork,
    };
  }
}

