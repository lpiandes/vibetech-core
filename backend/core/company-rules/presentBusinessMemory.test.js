import assert from "node:assert/strict";
import { test } from "node:test";

import { presentBusinessMemory } from "./presentBusinessMemory.js";

test("presentBusinessMemory maps RFT contract and active rules into business memory", () => {
  const presented = presentBusinessMemory({
    configuration: {
      services: [{ name: "Managed follow-up" }, "Proposal recovery"],
      customerTypes: ["Prospects", { label: "Existing customers" }],
      brandVoice: "Direct, calm, and specific.",
      employees: [{
        employeeId: "emp_rft",
        label: "Revenue Follow-Through",
        assignmentRules: {
          primary: "Route every inbound to the account owner when known.",
        },
        operatingContract: {
          schemaId: "revenue_follow_through",
          scope: {
            answers: {
              constraints: "Never send pricing outside approved policy.",
            },
          },
          rft: {
            sla: {
              acknowledgeWithinMinutes: 10,
              operatingHoursOnly: true,
              proposalReviewCadenceDays: 2,
              assignmentRequired: true,
              meetingNextStepRequired: true,
            },
            approvalRules: {
              customerFacingRequiresApproval: true,
              pricingOutsidePolicyRequiresApproval: true,
              newProspectOutboundRequiresApproval: true,
              existingCustomerSchedulingMayAuto: false,
            },
            failureConditions: ["sla_breach", "pricing_outside_policy"],
            exceptionOwner: "customer_owner",
          },
        },
      }],
      governedLearning: {
        ruleVersions: [{
          ruleId: "rule_1",
          version: 1,
          status: "active",
          title: "Use a calmer proposal tone",
          body: "Keep proposal follow-up concise and avoid urgency language.",
        }],
      },
    },
  });

  assert.equal(presented.contracts.length, 1);
  assert.equal(presented.memoryValues.Services, "Managed follow-up, Proposal recovery");
  assert.equal(presented.memoryValues["Customer types"], "Prospects, Existing customers");
  assert.match(presented.memoryValues["Response-time promises"], /10 minutes during operating hours/i);
  assert.match(presented.memoryValues["Approval policies"], /customer-facing actions require approval/i);
  assert.match(presented.memoryValues["Assignment rules"], /requires an assigned owner/i);
  assert.match(presented.memoryValues["Assignment rules"], /route every inbound to the account owner/i);
  assert.match(presented.memoryValues["Escalation rules"], /exception owner: customer owner/i);
  assert.match(presented.memoryValues["Scheduling rules"], /approval-gated/i);
  assert.match(presented.memoryValues["Scheduling rules"], /every 2 days/i);
  assert.equal(presented.memoryValues["Known exceptions"], "sla breach, pricing outside policy");
  assert.match(presented.memoryValues["Approved pricing boundaries"], /pricing outside approved policy requires approval/i);
  assert.match(presented.memoryValues["Learned preferences"], /use a calmer proposal tone/i);
});

test("non-RFT operating contracts do not invent Managed Revenue Follow-Through memory", () => {
  const presented = presentBusinessMemory({
    configuration: {
      employees: [{
        employeeId: "emp_receptionist",
        label: "AI Receptionist",
        operatingContract: {
          schemaId: "responsibility_operator",
          responsibilityId: "front_desk",
          version: "2",
          approvalSummary: "Owner approves after-hours callbacks.",
        },
      }],
    },
  });

  assert.equal(presented.contracts.length, 1);
  assert.equal(presented.memoryValues.Services, undefined);
  assert.equal(presented.memoryValues["Customer types"], undefined);
  assert.equal(presented.memoryValues["Response-time promises"], undefined);
  assert.equal(presented.memoryValues["Assignment rules"], undefined);
  assert.equal(presented.memoryValues["Escalation rules"], undefined);
  assert.equal(presented.memoryValues["Scheduling rules"], undefined);
  assert.match(presented.memoryValues["Approval policies"], /installed operating contract v2/i);
  assert.match(presented.memoryValues["Learned preferences"], /No repeating corrections yet/i);
  assert.equal(
    /Managed Revenue Follow-Through/.test(JSON.stringify(presented.memoryValues)),
    false,
  );
});
