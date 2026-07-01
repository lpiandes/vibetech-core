/**
 * demo-website-intake.js
 *
 * Demonstrates the local-only WebsiteInquiryAdapter:
 * - create a realistic website inquiry
 * - run adapter
 * - print:
 *   Website Inquiry Received
 *   Employee Summary
 *   Review Work Response
 */

import { WebsiteInquiryAdapter } from "./WebsiteInquiryAdapter.js";

async function main() {
  const adapter = new WebsiteInquiryAdapter();

  const payload = {
    inquiry: {
      name: "Emily Carter",
      email: "emily.carter@example.com",
      phone: "(555) 014-8872",
      message:
        "Hi! I’m interested in this property and would like to discuss next steps today. Is there anything urgent I should know about?",
      submittedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    },
    property: {
      propertyId: "prop_68_mystic",
      address: "68 Mystic Meadow Lane",
      city: "Hartford",
      state: "CT",
      price: 615000,
      description:
        "Light-filled home with a flexible layout and upgrades that make day-to-day living comfortable.",
      highlights: [
        "Updated kitchen and open-plan living",
        "Natural light throughout",
        "Walkable to local amenities",
      ],
      considerations: [
        "Confirm timeline for closing and key milestones",
        "Review any HOA items that may affect next steps",
        "Check zoning constraints for planned renovations",
      ],
    },
    companyContext: {
      companyName: "ABC Property Group",
      officeName: "Hartford Office",
      responsePolicy:
        "Respond with clear next steps, confirm key property details, and keep all communications governance-ready until guidance is provided.",
    },
  };

  console.log("Website Inquiry Received");

  const result = await adapter.intake(payload);

  console.log("\nEmployee Summary");
  console.log(JSON.stringify(result.employeeSummary, null, 2));

  console.log("\nReview Work Response");
  console.log(JSON.stringify(result.reviewWork, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

