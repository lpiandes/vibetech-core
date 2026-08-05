import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { RFT_SCHEMA_ID } from "./rft/rftCatalog.js";

const FIELD = (key, label, opts = {}) => deepFreeze({
  key,
  universalKey: opts.universalKey ?? key,
  label,
  input: opts.input ?? "text",
  required: opts.required !== false,
  placeholder: opts.placeholder ?? "",
  help: opts.help ?? "",
});

/**
 * Operating-contract schema for Managed Revenue Follow-Through (B2B services).
 */
export const SCHEMA_REVENUE_FOLLOW_THROUGH = deepFreeze({
  schemaId: RFT_SCHEMA_ID,
  industry: "professional_services",
  roleIds: ["revenue_follow_through", "sales_coordinator"],
  archetypeIds: ["follow_up_specialist"],
  labelMatchers: [
    /revenue\s*follow[\s-]*through/i,
    /sales\s*coord/i,
    /opportunity\s*follow/i,
  ],
  triggerDefaults: {
    mode: "manual_or_events",
    eventTypes: [
      "NEW_INQUIRY",
      "FORM_SUBMIT",
      "META_LEAD",
      "INBOUND_VOICE_CALL",
      "PIPELINE_CARD_CREATED",
      "PIPELINE_STAGE_ENTERED",
      "SPECIALTY_JOB_REQUESTED",
    ],
    schedule: null,
    summary:
      "When an inbound opportunity arrives (website, Meta, email, missed call) or a pipeline card moves.",
  },
  executesDefaults: {
    workTypes: [
      "opportunity_acknowledgement",
      "assignment",
      "schedule_coordination",
      "follow_up_draft",
      "proposal_monitor",
      "won_handoff",
    ],
    summary:
      "Detects opportunities, drafts acknowledgements, assigns owners, coordinates next steps, monitors proposals, and prepares delivery handoffs — with approval until autonomy is earned.",
  },
  scopeFields: [
    FIELD("audience", "Which opportunities does VIBETech own?", {
      universalKey: "audience",
      input: "textarea",
      placeholder: "e.g. All inbound commercial service leads and open proposals over $5k",
      help: "Customer types and deal sizes covered by Revenue Follow-Through.",
    }),
    FIELD("when", "Response-time promise", {
      universalKey: "when",
      input: "textarea",
      placeholder: "e.g. Acknowledge every eligible lead within 5 minutes during operating hours",
    }),
    FIELD("where", "Where do opportunities arrive?", {
      universalKey: "where",
      input: "tags",
      placeholder: "Website form, Gmail, Meta leads, HubSpot",
    }),
    FIELD("howMany", "Typical volume", {
      universalKey: "howMany",
      input: "text",
      placeholder: "e.g. 10–40 opportunities per week",
      required: false,
    }),
    FIELD("constraints", "Hard rules and approval boundaries", {
      universalKey: "constraints",
      input: "textarea",
      placeholder:
        "e.g. Never send pricing outside the approved list; escalate government accounts; owner approves new-prospect outbound",
    }),
  ],
});
