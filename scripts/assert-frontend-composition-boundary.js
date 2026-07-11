/**
 * Fails when production frontend code imports backend infrastructure entrypoints.
 * Composition root (frontend/lib/server/**) is the only allowed place to wire infra.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const frontendRoot = path.join(repoRoot, "frontend");

const FORBIDDEN_PATH_SNIPPETS = [
  "backend/core/platform/db/pool.js",
  "backend/core/platform/persistence/platformStore.js",
  "backend/core/platform/persistence/PostgresPlatformStore.js",
  "backend/core/platform/delivery/",
  "backend/providers/",
  "backend/core/import/storage/LocalFilesystemImportStorage.js",
  "backend/core/platform/services/invitationService.default.js",
  "backend/core/platform/services/platformBusinessService.default.js",
  "backend/core/platform/services/devInvitationService.default.js",
  "backend/core/platform/demoWorkspaceProvisioner.default.js",
  "backend/core/platform/knowledge/businessKnowledgeService.default.js",
  "backend/core/platform/campaigns/businessCampaignTemplateService.default.js",
  "backend/core/import/crmImportOrchestrationService.default.js",
  "backend/core/import/persistence/importRunRepository.default.js",
  "backend/core/import/storage/importArtifactStore.default.js",
  "backend/core/persistence/configureBackendWorkspacePersistence.js",
  "backend/core/platform/authorizeBusinessAccess.js",
  "backend/core/communications/providers/gmail/",
  "backend/core/integrations/adapters/GmailIntegrationAdapter.js",
];

const ALLOWED_PURE_SNIPPETS = [
  "backend/core/platform/permissions/",
  "backend/core/platform/contracts/",
  "backend/core/platform/platformTestData.js",
  "backend/core/platform/requestTiming.js",
  "backend/core/platform/authorizationScopeCache.js",
  "backend/core/platform/invitations/",
  "backend/core/platform/AuthorizationError.js",
  "backend/core/platform/createAuthorizationService.js",
  "backend/core/platform/persistence/platformMappers.js",
];

const COMPOSITION_ROOT_PREFIX = path.join(frontendRoot, "lib", "server") + path.sep;

const IMPORT_RE = /(?:import|export)\s+(?:type\s+)?(?:[^'"\n]+from\s+)?["']([^"']+)["']/g;

function shouldSkipFile(filePath) {
  const rel = path.relative(frontendRoot, filePath);
  if (rel.includes(`${path.sep}node_modules${path.sep}`)) return true;
  if (rel.includes(`${path.sep}.next`) || rel.startsWith(".next")) return true;
  if (/\.test\.(ts|tsx|js|jsx|mjs|cjs)$/.test(rel)) return true;
  if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(rel)) return true;
  return false;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name.startsWith(".next")) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function resolveImport(fromFile, spec) {
  if (!spec.startsWith(".")) return null;
  const abs = path.resolve(path.dirname(fromFile), spec);
  return path.relative(repoRoot, abs).replace(/\\/g, "/");
}

function isCompositionRoot(filePath) {
  return filePath.startsWith(COMPOSITION_ROOT_PREFIX) || filePath === path.join(frontendRoot, "lib", "server");
}

function isTypeOnlyImport(line) {
  return /^\s*import\s+type\s+/.test(line) || /import\s+type\s*\{/.test(line);
}

function collectViolations() {
  const violations = [];
  for (const file of walk(frontendRoot)) {
    if (shouldSkipFile(file)) continue;
    if (isCompositionRoot(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isTypeOnlyImport(line)) continue;
      IMPORT_RE.lastIndex = 0;
      let m;
      while ((m = IMPORT_RE.exec(line))) {
        const spec = m[1];
        let normalized = null;
        if (spec.includes("backend/")) {
          const idx = spec.indexOf("backend/");
          normalized = spec.slice(idx).replace(/\\/g, "/");
        } else if (spec.startsWith(".")) {
          normalized = resolveImport(file, spec);
        }
        if (!normalized) continue;
        const hit = FORBIDDEN_PATH_SNIPPETS.find((snip) => normalized.includes(snip));
        if (!hit) continue;
        if (ALLOWED_PURE_SNIPPETS.some((p) => normalized.includes(p))) continue;
        violations.push({
          file: path.relative(repoRoot, file).replace(/\\/g, "/"),
          line: i + 1,
          import: normalized,
          rule: hit,
        });
      }
    }
  }
  return violations;
}

test("frontend production code does not import backend infrastructure entrypoints", () => {
  const violations = collectViolations();
  assert.deepEqual(
    violations,
    [],
    `Forbidden backend infrastructure imports:\n${violations
      .map((v) => `  ${v.file}:${v.line} -> ${v.import} (matched ${v.rule})`)
      .join("\n")}`,
  );
});
