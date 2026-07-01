/**
 * Demo: Company Event Engine
 *
 * Creates one website inquiry event, applies it via the runtime event path,
 * then prints derived business views:
 * - metrics
 * - activities
 * - work queue
 * - buyers
 * - inquiries
 */

import { CompanyWorkspaceRuntime } from "../CompanyWorkspaceRuntime.js";
import { createCompanyEvent } from "./CompanyEvent.js";
import { COMPANY_EVENT_TYPES } from "./CompanyEventTypes.js";

function printSection(title, value) {
  console.log(`\n=== ${title} ===`);
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

async function main() {
  const runtime = new CompanyWorkspaceRuntime();

  const event = createCompanyEvent({
    type: COMPANY_EVENT_TYPES.WEBSITE_INQUIRY_RECEIVED,
    source: "website",
    timestampISO: "2026-06-26T09:10:00.000Z",
    payload: {
      buyer: {
        buyerId: "buyer_web_rachael",
        name: "Rachael Nguyen",
        email: "rachael.nguyen@example.com",
        phone: "(555) 019-2219",
      },
      propertyId: "prop_68_mystic",
      message:
        "Hi there—I'm interested in 68 Mystic Meadow Lane. Can you share next steps and a good walkthrough window?",
      submittedAtISO: "2026-06-26T09:10:00.000Z",
      priority: "High",
      employeeName: "Property Interest Coordinator",
      queueVisible: true,
      draftResponseReady: false,
    },
  });

  runtime.applyEvent(event);

  const metrics = runtime.getMetrics();
  const activities = runtime.getActivities();
  const queue = runtime.getWorkQueue();
  const companyData = runtime.getCompanyData();

  printSection("Metrics", metrics);
  printSection("Activities", activities);
  printSection("Queue", queue);
  printSection("Buyers", companyData.buyers);
  printSection("Inquiries", companyData.inquiries);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

