/**
 * demo-property-interest.js
 *
 * Demonstrates the PropertyInterestCoordinator local-only flow:
 * - Create mock property
 * - Create mock inquiry
 * - Run the employee
 * - Print Employee Summary and ReviewWorkResponse
 */

import { PropertyInterestCoordinator } from "./PropertyInterestCoordinator.js";

async function main() {
  const property = {
    propertyId: "prop_68_mystic",
    address: "68 Mystic Meadow Lane",
    city: "Hartford",
    state: "CT",
    price: 615000,
    description:
      "A light-filled property with room to grow, ideally suited for buyers seeking a calm neighborhood and flexible layout.",
    highlights: [
      "Updated kitchen and open-plan living",
      "Natural light throughout",
      "Walkable to local amenities",
    ],
    considerations: [
      "Buyer may need to confirm timeline for closing",
      "Potential HOA items require clarification",
      "Check zoning-related constraints for planned renovations",
    ],
  };

  const inquiry = {
    name: "Jordan Lee",
    email: "jordan.lee@example.com",
    phone: "(555) 010-2211",
    message:
      "Hi team—I'm interested in the property and would love to discuss next steps today. Is there any urgent paperwork or timing I should know about?",
    submittedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // ~1 hour ago
  };

  const companyContext = {
    companyName: "VIBETech Realty",
    officeName: "Hartford Office",
    responsePolicy:
      "Respond with clear next steps, confirm key property details, and keep all communications governance-ready until attorney guidance is provided.",
  };

  const coordinator = new PropertyInterestCoordinator();
  const result = await coordinator.run({ inquiry, property, companyContext });

  console.log("\nEmployee Summary:");
  console.log(JSON.stringify(result.employeeSummary, null, 2));

  console.log("\nReview Work Response:");
  console.log(JSON.stringify(result.reviewWork, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

