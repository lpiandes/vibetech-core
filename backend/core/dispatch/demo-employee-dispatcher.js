/**
 * demo-employee-dispatcher.js
 *
 * Validates event -> runtime -> dispatcher -> employee outputs.
 */

import { CompanyWorkspaceRuntime } from "../company/CompanyWorkspaceRuntime.js";
import { createCompanyEvent } from "../company/events/CompanyEvent.js";
import { COMPANY_EVENT_TYPES } from "../company/events/CompanyEventTypes.js";
import { EmployeeDispatcher } from "./EmployeeDispatcher.js";

function printSection(title, value) {
  console.log(`\n=== ${title} ===`);
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

async function main() {
  const runtime = new CompanyWorkspaceRuntime();
  const dispatcher = new EmployeeDispatcher({ runtime });

  const event = createCompanyEvent({
    type: COMPANY_EVENT_TYPES.WEBSITE_INQUIRY_RECEIVED,
    source: "website",
    timestampISO: new Date().toISOString(),
    payload: {
      buyer: {
        buyerId: "buyer_web_demo_dispatch",
        name: "Rachael Nguyen",
        email: "rachael.nguyen@example.com",
        phone: "(555) 019-2219",
      },
      propertyId: "prop_68_mystic",
      message:
        "Hi! I’m interested in the property and would like to discuss next steps today. Is there anything urgent I should know about?",
      submittedAtISO: new Date().toISOString(),
      priority: "High",
      employeeName: "Property Interest Coordinator",
      queueVisible: true,
      draftResponseReady: true,
      responseTimeMinutes: 32,
      status: "Needs Review",
      companyContext: {
        companyName: runtime.getCompany().companyName,
        officeName: runtime.getCompany().officeName,
        responsePolicy:
          "Respond with clear next steps, confirm key property details, and keep all communications governance-ready until guidance is provided.",
      },
    },
  });

  runtime.applyEvent(event);

  const dispatchResult = await dispatcher.dispatch(event);

  printSection("Event", event);
  printSection("Assigned Employee", dispatchResult.assignedEmployee);
  printSection("Employee Summary", dispatchResult.employeeSummary);
  printSection("Review Work", dispatchResult.reviewWork);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

