import { createAutomationTemplate } from "./AutomationTemplate.js";
import { validateAutomationTemplate } from "./AutomationTemplateValidator.js";

function fail(message) {
  throw new Error(`AutomationTemplateRegistry: ${message}`);
}

/** Universal mechanism: when a canonical outcome matches, create configured work. */
export const OUTCOME_CREATES_WORK_TEMPLATE = createAutomationTemplate({
  id: "tpl_outcome_creates_work",
  name: "Outcome Creates Work",
  description: "When a configured canonical outcome is recorded, create work with configured parameters.",
  status: "ACTIVE",
  version: 1,
  trigger: {
    eventType: { sourceType: "CONFIG_VALUE", key: "triggerEventType" },
  },
  conditions: [
    {
      fieldPath: { sourceType: "CONFIG_VALUE", key: "outcomeFieldPath" },
      operator: "EQUALS",
      value: { sourceType: "CONFIG_VALUE", key: "outcomeValue" },
    },
  ],
  actions: [
    {
      id: { sourceType: "CONFIG_VALUE", key: "actionId" },
      actionType: "CREATE_WORK",
      requiresApproval: { sourceType: "CONFIG_VALUE", key: "requiresApproval" },
      order: 1,
      parameters: {
        workItemId: {
          sourceType: "CONCAT",
          parts: [
            { sourceType: "CONFIG_VALUE", key: "workItemIdPrefix" },
            { sourceType: "EVENT_FIELD", fieldPath: "payload.interactionId" },
          ],
        },
        workType: { sourceType: "CONFIG_VALUE", key: "workType" },
        title: { sourceType: "CONFIG_VALUE", key: "title" },
        description: { sourceType: "CONFIG_VALUE", key: "description" },
        priority: { sourceType: "CONFIG_VALUE", key: "priority" },
        stageId: { sourceType: "CONFIG_VALUE", key: "stageId" },
        queueId: { sourceType: "CONFIG_VALUE", key: "queueId" },
        assignedTo: { sourceType: "CONFIG_VALUE", key: "assignedTo" },
        dueAt: { sourceType: "EVENT_FIELD", fieldPath: "payload.followUpAt" },
        relatedObjects: {
          sourceType: "ARRAY_CONCAT",
          parts: [{ sourceType: "INTERACTION_FIELD", fieldPath: "relatedObjects" }, [{ interactionId: { sourceType: "EVENT_FIELD", fieldPath: "payload.interactionId" } }]],
        },
        requestedBy: { sourceType: "CONFIG_VALUE", key: "requestedBy" },
        source: { sourceType: "CONFIG_VALUE", key: "source" },
        status: { sourceType: "CONFIG_VALUE", key: "workStatus" },
        metadata: { derivedFrom: { templateId: "tpl_outcome_creates_work" } },
      },
      metadata: {},
    },
  ],
  requiredConfiguration: [
    { key: "triggerEventType" },
    { key: "outcomeFieldPath" },
    { key: "outcomeValue" },
    { key: "actionId" },
    { key: "requiresApproval" },
    { key: "workItemIdPrefix" },
    { key: "workType" },
    { key: "title" },
    { key: "description" },
    { key: "priority" },
    { key: "stageId" },
    { key: "queueId" },
    { key: "assignedTo" },
    { key: "requestedBy" },
    { key: "source" },
    { key: "workStatus" },
  ],
  metadata: { universal: true },
});

const REGISTRY = new Map([
  [OUTCOME_CREATES_WORK_TEMPLATE.id, OUTCOME_CREATES_WORK_TEMPLATE],
]);

export class AutomationTemplateRegistry {
  constructor({ templates } = {}) {
    this._templates = new Map(REGISTRY);
    if (templates && typeof templates === "object") {
      for (const [id, tpl] of Object.entries(templates)) {
        this.register(tpl);
      }
    }
  }

  register(template) {
    validateAutomationTemplate(template);
    const id = String(template.id);
    if (this._templates.has(id)) fail(`duplicate template id: ${id}`);
    this._templates.set(id, template);
    return template;
  }

  getTemplate(id) {
    return this._templates.get(String(id)) ?? null;
  }

  listTemplates() {
    return [...this._templates.values()];
  }
}

export function getDefaultAutomationTemplateRegistry() {
  return new AutomationTemplateRegistry();
}
