import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Universal Renderer contracts.
 * Live portal implementations live under frontend/lib/portal-renderer and
 * frontend/components/portal-renderer — registered components only, never arbitrary UI.
 */
export const UNIVERSAL_RENDERERS = Object.freeze([
  {
    rendererId: "navigation",
    name: "Navigation Renderer",
    responsibility: "Project Business OS navigation into safe route-driven menu items.",
    inputs: ["modules", "roleAccess", "appearance"],
    outputs: ["primaryItems", "overflowItems", "searchAvailable"],
  },
  {
    rendererId: "dashboard",
    name: "Dashboard Renderer",
    responsibility: "Compose home dashboard cards from registered component types and projections.",
    inputs: ["dashboardDefinitions", "permissions", "emptyStates"],
    outputs: ["cards", "ordering", "rejectedTypes"],
  },
  {
    rendererId: "workspace",
    name: "Workspace Renderer",
    responsibility: "Render module workspaces (lists, queues, calendars) from registered module components.",
    inputs: ["moduleDefinition", "viewType", "permissions"],
    outputs: ["viewModel", "actions"],
  },
  {
    rendererId: "component",
    name: "Component Renderer",
    responsibility: "Resolve only registered UI component types — never arbitrary JSX.",
    inputs: ["componentType", "propsProjection"],
    outputs: ["resolvedComponent", "rejected"],
  },
  {
    rendererId: "terminology",
    name: "Terminology Renderer",
    responsibility: "Apply presentation terminology labels without changing canonical types.",
    inputs: ["terminology", "canonicalLabel"],
    outputs: ["displayLabel"],
  },
]);

export function getUniversalRenderer(rendererId) {
  return UNIVERSAL_RENDERERS.find((entry) => entry.rendererId === String(rendererId)) ?? null;
}

export function listUniversalRenderers() {
  return UNIVERSAL_RENDERERS;
}

export function validateRendererContract(renderer) {
  const errors = [];
  if (!renderer?.rendererId) errors.push("rendererId_required");
  if (!renderer?.name) errors.push("name_required");
  if (!renderer?.responsibility) errors.push("responsibility_required");
  if (!Array.isArray(renderer?.inputs)) errors.push("inputs_required");
  if (!Array.isArray(renderer?.outputs)) errors.push("outputs_required");
  return deepFreeze({ ok: errors.length === 0, errors });
}

export function assertAllRendererContractsRegistered() {
  const results = UNIVERSAL_RENDERERS.map((renderer) => ({
    rendererId: renderer.rendererId,
    ...validateRendererContract(renderer),
  }));
  const ok = results.every((entry) => entry.ok);
  return deepFreeze({ ok, results });
}
