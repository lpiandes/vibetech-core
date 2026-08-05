import { cache } from "react";
import { platformStore } from "@/lib/server/compose";

const TTL_MS = 60_000;
const knowledgeCache = new Map<string, { at: number; value: number }>();
const proofCache = new Map<string, { at: number; value: any[] }>();

export const getCachedKnowledgeDocumentCount = cache(async (businessId: string) => {
  const id = String(businessId);
  const hit = knowledgeCache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = Number(await platformStore.countActiveKnowledgeDocuments(businessId).catch(() => 0)) || 0;
  knowledgeCache.set(id, { at: Date.now(), value });
  return value;
});

export const getCachedCapabilityProofRows = cache(async (businessId: string) => {
  const id = String(businessId);
  const hit = proofCache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = await platformStore.listCapabilityProofRecords(businessId).catch(() => []);
  proofCache.set(id, { at: Date.now(), value: value ?? [] });
  return value ?? [];
});
