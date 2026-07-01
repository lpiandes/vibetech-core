import crypto from "node:crypto";

import { stableStringify } from "../utils/stableStringify.js";

function sha256(str) {
  return crypto.createHash("sha256").update(String(str)).digest("hex");
}

function normalizeLower(s) {
  return String(s ?? "").toLowerCase().trim();
}

function fingerprintFromStrings({ title, tags, metadata, plainText } = {}) {
  const payload = {
    title: normalizeLower(title),
    tags: Array.isArray(tags) ? tags.map(normalizeLower).sort() : [],
    metadata: metadata ?? {},
    plainTextPreview: String(plainText ?? "").slice(0, 800),
  };

  return sha256(stableStringify(payload));
}

function fingerprintFromKnowledgeItem(item) {
  return fingerprintFromStrings({
    title: item?.title,
    tags: item?.searchKeywords ?? item?.tags ?? [],
    metadata: item?.metadata ?? {},
    plainText: item?.description ?? "",
  });
}

export class DuplicateDetector {
  /**
   * @param {object} params
   * @param {object} params.runtime
   */
  constructor({ runtime } = {}) {
    this.runtime = runtime;
  }

  findDuplicateCandidates({ processedDocument, suggestedTags } = {}) {
    const runtime = this.runtime;
    const repo = runtime?.getKnowledgeRepository?.() ?? null;
    if (!repo || !Array.isArray(repo.items)) return { duplicateCandidates: [], fingerprint: "" };

    const fingerprint = fingerprintFromStrings({
      title: processedDocument?.title,
      tags: suggestedTags,
      metadata: processedDocument?.metadata ?? {},
      plainText: processedDocument?.plainText ?? "",
    });

    const duplicateCandidates = [];
    for (const item of repo.items) {
      if (item?.status === "ARCHIVED") continue;
      const fp = fingerprintFromKnowledgeItem(item);
      if (fp === fingerprint) {
        duplicateCandidates.push({
          knowledgeItemId: item.id,
          matchedFingerprint: fp,
        });
      }
    }

    duplicateCandidates.sort(
      (a, b) => a.knowledgeItemId.localeCompare(b.knowledgeItemId),
    );

    return { duplicateCandidates, fingerprint };
  }
}

