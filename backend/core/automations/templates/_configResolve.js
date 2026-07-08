import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`AutomationTemplate._configResolve: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function resolveConfigNode(node, configuration) {
  if (Array.isArray(node)) {
    return node.map((x) => resolveConfigNode(x, configuration));
  }

  if (isPlainObject(node) && typeof node.sourceType === "string") {
    if (node.sourceType === "CONFIG_VALUE") {
      const key = String(node.key ?? "");
      if (!key) fail("CONFIG_VALUE requires key.");
      if (!(key in configuration)) fail(`Missing configuration key: ${key}`);
      const val = configuration[key];
      return resolveConfigNode(val, configuration);
    }
  }

  if (isPlainObject(node)) {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = resolveConfigNode(v, configuration);
    return out;
  }

  return node;
}

export function resolveConfigValueSpecs(node, configuration) {
  const resolved = resolveConfigNode(node, configuration);
  return deepFreeze(resolved);
}
