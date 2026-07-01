/**
 * demo-company-brain.js
 *
 * Demo:
 * - create a company (runtime seed)
 * - load: Property FAQ, Office policy, Brand voice (via runtime knowledge)
 * - run CompanyBrain.buildBusinessContext()
 * - print BusinessContext
 * - show how PropertyInterestCoordinator uses it (property research capability)
 */

import { CompanyWorkspaceRuntime } from "../CompanyWorkspaceRuntime.js";
import { CompanyBrain } from "./CompanyBrain.js";
import { PropertyInterestCoordinator } from "../../employees/property-interest-coordinator/PropertyInterestCoordinator.js";
import { PropertyResearchCapability } from "../../capabilities/property/PropertyResearchCapability.js";

function printSection(title, value) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(value, null, 2));
}

async function main() {
  const runtime = new CompanyWorkspaceRuntime();
  const brain = new CompanyBrain({ runtime });

  const property = runtime.getCompanyData().properties[0];
  const inquiry = runtime.getCompanyData().inquiries[0];

  const businessContext = brain.buildBusinessContext({
    employeeId: "emp_prop_interest",
    task: "PROPERTY_RESEARCH",
    companyId: runtime.getCompany().companyName,
    relatedEntities: {
      property,
      buyerInquiry: inquiry,
    },
  });

  printSection("BusinessContext", businessContext);

  // Show PropertyInterestCoordinator using it:
  const coordinator = new PropertyInterestCoordinator();
  const responsePolicy = runtime.getKnowledge().responsePreferences?.[0] ?? "";

  const capabilityCompanyKnowledge = {
    responsePreferences: businessContext.operationalRules.responsePreferences,
    propertyShowingRules: businessContext.operationalRules.propertyShowingRules,
  };

  const capabilityOutput = new PropertyResearchCapability().run({
    property,
    buyerInquiry: inquiry,
    companyKnowledge: capabilityCompanyKnowledge,
  });
  printSection("PropertyResearchCapability output", capabilityOutput);

  // Coordinator integration is updated in the employee file; this demo calls the same
  // run contract it expects in the dispatcher path.
  const runResult = await coordinator.run({
    inquiry: {
      name: inquiry.buyerId,
      message: inquiry.message,
      priority: inquiry.priority,
      submittedAt: inquiry.submittedAtISO,
    },
    property,
    companyContext: {
      responsePolicy,
    },
    runtime,
  });
  printSection("PropertyInterestCoordinator runResult", runResult);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

