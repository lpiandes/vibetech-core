import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Business Intelligence Graph contract — schema only, minimal implementation.
 */
export const GRAPH_NODE_KINDS = Object.freeze([
  "department",
  "role",
  "service",
  "workflow",
  "object",
  "approval",
  "kpi",
  "integration",
  "communication",
  "policy",
]);

export const GRAPH_EDGE_KINDS = Object.freeze([
  "belongs_to",
  "performs",
  "requires",
  "approves",
  "measures",
  "integrates_with",
  "communicates_via",
  "governed_by",
  "produces",
  "consumes",
]);

export function createGraphNode({
  nodeId,
  kind,
  label,
  attributes = {},
} = {}) {
  if (!nodeId) throw new Error("BusinessIntelligenceGraph: nodeId required.");
  if (!GRAPH_NODE_KINDS.includes(String(kind))) {
    throw new Error(`BusinessIntelligenceGraph: unsupported node kind "${kind}".`);
  }
  return deepFreeze({
    nodeId: String(nodeId),
    kind: String(kind),
    label: String(label ?? kind),
    attributes: deepFreeze({ ...(attributes ?? {}) }),
  });
}

export function createGraphEdge({
  edgeId,
  kind,
  fromNodeId,
  toNodeId,
  attributes = {},
} = {}) {
  if (!edgeId) throw new Error("BusinessIntelligenceGraph: edgeId required.");
  if (!GRAPH_EDGE_KINDS.includes(String(kind))) {
    throw new Error(`BusinessIntelligenceGraph: unsupported edge kind "${kind}".`);
  }
  if (!fromNodeId || !toNodeId) {
    throw new Error("BusinessIntelligenceGraph: fromNodeId and toNodeId required.");
  }
  return deepFreeze({
    edgeId: String(edgeId),
    kind: String(kind),
    fromNodeId: String(fromNodeId),
    toNodeId: String(toNodeId),
    attributes: deepFreeze({ ...(attributes ?? {}) }),
  });
}

export function createBusinessIntelligenceGraph({
  graphId = `graph_${Date.now()}`,
  businessId = null,
  nodes = [],
  edges = [],
} = {}) {
  return deepFreeze({
    contract: "BusinessIntelligenceGraph/v1",
    graphId: String(graphId),
    businessId: businessId == null ? null : String(businessId),
    nodes: Object.freeze(nodes.map((node) => (
      node?.nodeId ? node : createGraphNode(node)
    ))),
    edges: Object.freeze(edges.map((edge) => (
      edge?.edgeId ? edge : createGraphEdge(edge)
    ))),
  });
}

export function validateBusinessIntelligenceGraph(graph) {
  const errors = [];
  if (!graph || graph.contract !== "BusinessIntelligenceGraph/v1") {
    return deepFreeze({ ok: false, errors: ["invalid_contract"] });
  }
  const nodeIds = new Set();
  for (const node of graph.nodes ?? []) {
    if (!GRAPH_NODE_KINDS.includes(node.kind)) errors.push(`bad_node_kind:${node.nodeId}`);
    if (nodeIds.has(node.nodeId)) errors.push(`duplicate_node:${node.nodeId}`);
    nodeIds.add(node.nodeId);
  }
  for (const edge of graph.edges ?? []) {
    if (!GRAPH_EDGE_KINDS.includes(edge.kind)) errors.push(`bad_edge_kind:${edge.edgeId}`);
    if (!nodeIds.has(edge.fromNodeId)) errors.push(`missing_from:${edge.edgeId}`);
    if (!nodeIds.has(edge.toNodeId)) errors.push(`missing_to:${edge.edgeId}`);
  }
  return deepFreeze({ ok: errors.length === 0, errors });
}
