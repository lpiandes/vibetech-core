/**
 * demo-website-event-intake.js
 *
 * Demonstrates end-to-end event flow:
 * - Instantiate CompanyWorkspaceRuntime
 * - Print initial metrics + queue
 * - Submit one website inquiry through WebsiteInquiryAdapter
 * - Verify the inquiry appears in runtime-derived metrics/activities/queue/buyers/inquiries
 */

import { CompanyWorkspaceRuntime } from "../company/CompanyWorkspaceRuntime.js";
import { WebsiteInquiryAdapter } from "./WebsiteInquiryAdapter.js";

function printSection(title, value) {
  console.log(`\n=== ${title} ===`);
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

async function main() {
  const runtime = new CompanyWorkspaceRuntime();
  const adapter = new WebsiteInquiryAdapter();

  printSection("Initial Metrics", runtime.getMetrics());
  printSection("Initial Work Queue", runtime.getWorkQueue());

  const payload = {
    runtime,
    inquiry: {
      name: "Rachael Nguyen",
      email: "rachael.nguyen@example.com",
      phone: "(555) 019-2219",
      message:
        "Hi! I’m interested in the property and would like to discuss next steps today. Can you share a good walkthrough window?",
      submittedAt: new Date().toISOString(),
      priority: "High",
    },
    property: {
      propertyId: "prop_68_mystic",
    },
    companyContext: {
      companyName: runtime.getCompany().companyName,
      officeName: runtime.getCompany().officeName,
      responsePolicy:
        "Respond with clear next steps, confirm key property details, and keep all communications governance-ready until guidance is provided.",
    },
  };

  const result = await adapter.intake(payload);

  printSection("Event Id", result.eventId);
  printSection("Assigned Employee", result.assignedEmployee);
  printSection("Employee Summary", result.employeeSummary);
  printSection("Review Work", result.reviewWork);
  printSection("Updated Metrics", runtime.getMetrics());
  printSection("Updated Activities", runtime.getActivities());
  printSection("Updated Buyers", runtime.getCompanyData().buyers);
  printSection("Updated Inquiries", runtime.getCompanyData().inquiries);
  printSection("Updated Work Queue", runtime.getWorkQueue());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

