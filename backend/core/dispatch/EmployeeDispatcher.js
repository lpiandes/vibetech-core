import { PropertyInterestCoordinator } from "../employees/property-interest-coordinator/PropertyInterestCoordinator.js";
import { COMPANY_EVENT_TYPES } from "../company/events/CompanyEventTypes.js";

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`EmployeeDispatcher: expected ${name} to be a non-empty string.`);
  }
}

export class EmployeeDispatcher {
  constructor({ runtime } = {}) {
    if (!runtime) throw new Error("EmployeeDispatcher requires `runtime`.");
    this.runtime = runtime;
    this.propertyInterestCoordinator = new PropertyInterestCoordinator();
  }

  async dispatch(event) {
    if (!event || typeof event !== "object") {
      throw new Error("EmployeeDispatcher: event must be an object.");
    }

    requiredString(event.id, "event.id");
    requiredString(event.type, "event.type");

    const payload = event.payload ?? {};

    switch (event.type) {
      case COMPANY_EVENT_TYPES.WEBSITE_INQUIRY_RECEIVED: {
        const buyer = payload.buyer;
        const propertyId = payload.propertyId;

        requiredString(buyer?.name, "payload.buyer.name");
        requiredString(buyer?.email, "payload.buyer.email");
        requiredString(buyer?.phone, "payload.buyer.phone");
        requiredString(payload?.message, "payload.message");
        requiredString(payload?.submittedAtISO, "payload.submittedAtISO");
        requiredString(propertyId, "payload.propertyId");

        const companyData = this.runtime.getCompanyData();
        const property = companyData.properties.find((p) => p.propertyId === propertyId);
        if (!property) {
          throw new Error(`EmployeeDispatcher: property not found: ${propertyId}`);
        }

        const companyContext = payload.companyContext ?? {};
        const responsePolicy = companyContext?.responsePolicy ?? "";
        requiredString(companyContext?.companyName ?? "ABC Property Group", "companyContext.companyName");
        requiredString(companyContext?.officeName ?? "Hartford Office", "companyContext.officeName");
        requiredString(responsePolicy || "Prompt, professional, governance-aware.", "companyContext.responsePolicy");

        const employeeInput = {
          inquiry: {
            name: buyer.name,
            email: buyer.email,
            phone: buyer.phone,
            message: payload.message,
            submittedAt: payload.submittedAtISO,
          },
          property: {
            ...property,
          },
          companyContext: {
            companyName: companyContext.companyName,
            officeName: companyContext.officeName,
            responsePolicy: responsePolicy,
          },
        };

        const { reviewWork, employeeSummary } =
          await this.propertyInterestCoordinator.run({
            ...employeeInput,
            runtime: this.runtime,
          });

        return {
          success: true,
          eventId: event.id,
          assignedEmployee: "Property Interest Coordinator",
          employeeSummary,
          reviewWork,
        };
      }

      default:
        throw new Error(`EmployeeDispatcher: Unsupported event type: ${event.type}`);
    }
  }
}

