/**
 * Platform job: run social background screen and open specialty draft Work for review.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { runSocialBackgroundScreen } from "../../integrations/social-screening/SocialBackgroundScreeningService.js";
import { readSocialScreeningKeys } from "../../integrations/social-screening/socialScreeningKeys.js";
import { getSharedCredentialVault } from "../../integrations/credentials/CredentialVault.js";
import { hydrateWorkspaceCredentials } from "../../integrations/credentials/durableCredentialVault.js";
import { fireSpecialtyTrigger } from "../../ai-builder/specialty/fireSpecialtyTrigger.js";
import { ensureEmployeeOperatingAutomationRegistered } from "../../ai-builder/specialty/registerEmployeeOperatingAutomation.js";
import {
  readCrmState,
  writeCrmState,
  upsertContact,
} from "../../crm/CrmStore.js";

export async function processSocialBackgroundScreenJob({
  job,
  platformStore,
  nowISO = () => new Date().toISOString(),
  loadWorkspace,
  runScreen = runSocialBackgroundScreen,
} = {}) {
  const businessId = String(job?.businessId ?? job?.payload?.businessId ?? "").trim();
  const payload = job?.payload && typeof job.payload === "object" ? job.payload : {};
  const employeeId = String(
    payload.employeeId ?? "emp_social_background_screener_default",
  );
  const subject = {
    name: String(payload.subjectName ?? payload.name ?? "").trim(),
    email: String(payload.email ?? "").trim(),
    phone: String(payload.phone ?? "").trim(),
    handles: Array.isArray(payload.handles) ? payload.handles.map(String) : [],
    location: String(payload.location ?? "").trim(),
    contactId: String(payload.contactId ?? "").trim() || null,
  };

  if (!businessId) {
    return deepFreeze({ ok: false, reason: "business_id_required" });
  }
  if (!subject.name) {
    return deepFreeze({ ok: false, reason: "subject_name_required" });
  }
  if (typeof loadWorkspace !== "function") {
    return deepFreeze({ ok: false, reason: "load_workspace_required" });
  }

  const loaded = await loadWorkspace(businessId);
  if (!loaded?.ok) {
    return deepFreeze({ ok: false, reason: loaded?.reason ?? "workspace_load_failed" });
  }

  const vault = loaded.credentialVault ?? getSharedCredentialVault();
  if (platformStore) {
    await hydrateWorkspaceCredentials({ platformStore, vault, workspaceId: businessId }).catch(() => null);
  }
  const cred = vault.get?.(`cred_social_screening_${businessId}`);
  let keys = null;
  if (cred?.secrets) {
    keys = {
      serperApiKey: cred.secrets.serperApiKey ?? cred.secrets.SERPER_API_KEY,
      scrapingBeeApiKey: cred.secrets.scrapingBeeApiKey ?? cred.secrets.SCRAPINGBEE_API_KEY,
    };
  }
  if (!keys?.serperApiKey || !keys?.scrapingBeeApiKey) {
    const fromEnv = readSocialScreeningKeys({ env: process.env });
    if (fromEnv.ready) keys = fromEnv;
  }

  const screen = await runScreen({
    subject,
    keys,
    fetchImpl: globalThis.fetch?.bind(globalThis),
  });
  if (!screen.ok) {
    return deepFreeze({ ok: false, reason: screen.reason ?? "screen_failed" });
  }

  const at = typeof nowISO === "function" ? nowISO() : String(nowISO);
  const employee = loaded.employee ?? {
    employeeId,
    id: employeeId,
    label: "Social Background Screener",
  };

  try {
    ensureEmployeeOperatingAutomationRegistered({
      automationRuntime: loaded.automationRuntime,
      employee,
      nowISO: at,
      status: "ACTIVE",
    });
  } catch {
    /* fire reports inactive */
  }

  const draft = await fireSpecialtyTrigger({
    workRuntime: loaded.workRuntime,
    automationRuntime: loaded.automationRuntime,
    approvalRuntime: loaded.approvalRuntime ?? null,
    employee,
    actorId: "social_background_screen",
    businessId,
    knowledgeDocuments: loaded.knowledgeDocuments ?? [],
    eventType: "SOCIAL_SCREEN_REQUESTED",
    eventLabel: "Social background screen completed",
    forceManual: true,
    brief: screen.reportBody,
    eventPayload: {
      name: subject.name,
      email: subject.email,
      phone: subject.phone,
      contactId: subject.contactId,
      socialScreenReport: screen.report,
    },
    installation: loaded.installation,
    platformStore,
    nowISO: () => at,
  });

  if (subject.contactId && loaded.installation && platformStore) {
    try {
      let crm = readCrmState(loaded.installation);
      const existing = (crm.contacts ?? []).find((c) => String(c.id) === subject.contactId);
      const noteBlock = [
        `Social background screen ${at}`,
        screen.report?.summary ?? "",
        draft?.workItemId ? `Work: ${draft.workItemId}` : "",
      ].filter(Boolean).join("\n");
      crm = upsertContact(crm, {
        ...(existing ?? { id: subject.contactId, name: subject.name }),
        id: subject.contactId,
        name: subject.name || existing?.name,
        email: subject.email || existing?.email,
        phone: subject.phone || existing?.phone,
        notes: [existing?.notes, noteBlock].filter(Boolean).join("\n\n"),
        tags: Array.from(new Set([...(existing?.tags ?? []), "social_screened"])),
      });
      await writeCrmState({
        platformStore,
        installation: loaded.installation,
        crm,
        actorId: "social_background_screen",
      });
    } catch {
      /* best effort */
    }
  }

  if (typeof loaded.persistWork === "function") {
    await loaded.persistWork().catch(() => null);
  }

  return deepFreeze({
    ok: Boolean(draft?.ok !== false),
    workItemId: draft?.workItemId ?? null,
    report: screen.report,
    profilesFound: screen.report?.profilesFound?.length ?? 0,
    draft,
  });
}
