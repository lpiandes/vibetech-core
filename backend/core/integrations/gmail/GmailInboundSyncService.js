/**
 * Track A — inbound Gmail sync (v1, pragmatic scope).
 *
 * Pulls recent inbox messages via GmailCommunicationProvider.listInbox/getMessage,
 * dedups by Gmail message id, matches/creates a CRM contact ("Person") by sender
 * email, and persists everything on `installation.configuration.gmailInbox` (see
 * GmailInboxStore). Approve-first: this service never sends anything.
 *
 * Triggered from three places:
 * 1. Manual "Sync now" — `frontend/app/api/businesses/[businessId]/integrations/gmail/sync/route.ts`.
 * 2. Once, best-effort, right after Gmail OAuth completes — `frontend/app/api/integrations/oauth/google/callback/route.ts`.
 * 3. A small recurring sweep piggybacked on the hosted platform job tick — see
 *    `runHostedGmailInboxSyncSweep` in `frontend/lib/server/runHostedPlatformJobTick.ts`
 *    and `selectDueGmailSyncBusinesses.js`. This is intentionally NOT a first-class
 *    `platform_jobs` job type: there's no JOB_TYPES entry / claimNext dispatch branch
 *    here, and no cron-style enqueue path in DurableWorkflowExecutor (the existing
 *    SPECIALTY_SCHEDULE_DUE / CALENDAR_REMINDER_DUE jobs are both triggered by other
 *    domain events, not time). A full job-registry entry would need more surgery
 *    than this pass warrants; the tick sweep is a pragmatic v1 middle ground.
 */
import { GmailIntegrationAdapter } from "../adapters/GmailIntegrationAdapter.js";
import { ensureCrmContactPersisted } from "../../crm/ensureCrmContactAndOptionalCard.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  readGmailInboxState,
  findStoredMessageByGmailId,
  mergeInboundMessages,
  writeGmailInboxState,
} from "./GmailInboxStore.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

export class GmailInboundSyncService {
  /**
   * @param {object} [params]
   * @param {object} [params.adapter] - injectable GmailIntegrationAdapter (tests)
   * @param {() => string} [params.nowISO]
   */
  constructor({ adapter = null, nowISO = () => new Date().toISOString() } = {}) {
    this._adapter = adapter ?? new GmailIntegrationAdapter();
    this._nowISO = typeof nowISO === "function" ? nowISO : () => String(nowISO);
  }

  /**
   * @param {object} params
   * @param {string} params.businessId
   * @param {object} params.platformStore
   * @param {object} params.installation - Business OS installation (fetched by caller)
   * @param {object} [params.connection] - business_email connection (for vault credentials)
   * @param {object} [params.credentialResolver]
   * @param {object} [params.provider] - injectable resolved GmailCommunicationProvider (tests)
   * @param {number} [params.maxResults]
   * @param {string} [params.actorId]
   */
  async sync({
    businessId,
    platformStore,
    installation,
    connection = null,
    credentialResolver = null,
    provider = null,
    maxResults = 25,
    actorId = "gmail_inbox_sync",
  } = {}) {
    if (!businessId || !platformStore || !installation) {
      return deepFreeze({ ok: false, reason: "business_and_installation_required" });
    }

    const gmailProvider = provider ?? this._adapter.resolveProvider({ connection, credentialResolver });
    if (!gmailProvider || gmailProvider.health === "not_configured") {
      return deepFreeze({
        ok: false,
        reason: "gmail_not_connected",
        message: "Connect Gmail (Connections → Gmail) before syncing the inbox.",
      });
    }

    let listing;
    try {
      listing = await gmailProvider.listInbox({ maxResults });
    } catch (err) {
      const message = String(err?.message ?? err);
      const scopeIssue = /insufficient|scope/i.test(message);
      await this.#recordSyncFailure({ platformStore, installation, actorId, message });
      return deepFreeze({
        ok: false,
        reason: scopeIssue ? "missing_readonly_scope" : "list_inbox_failed",
        message: scopeIssue
          ? "Gmail was connected before inbox read access was requested. Disconnect and reconnect Gmail to grant the readonly scope."
          : message,
      });
    }

    const currentInbox = readGmailInboxState(installation);
    const candidateIds = (listing.messages ?? [])
      .map((m) => safeString(m.id))
      .filter(Boolean)
      .filter((id) => !findStoredMessageByGmailId(currentInbox, id));

    const fetched = [];
    const fetchErrors = [];
    for (const id of candidateIds) {
      try {
        // eslint-disable-next-line no-await-in-loop -- Gmail API has no batch-get in this client version.
        const record = await gmailProvider.getMessage(id);
        fetched.push(record);
      } catch (err) {
        fetchErrors.push({ id, message: String(err?.message ?? err) });
      }
    }

    let workingInstallation = installation;
    let contactsCreated = 0;
    let contactsMatched = 0;
    const enrichedMessages = [];
    for (const record of fetched) {
      const email = safeString(record.from?.email);
      let personId = null;
      if (email) {
        try {
          const ensured = await ensureCrmContactPersisted({
            platformStore,
            installation: workingInstallation,
            actorId,
            contact: {
              name: record.from?.name || email,
              email,
              kind: "lead",
              tags: ["gmail_inbox"],
            },
            addToPipeline: false,
          });
          personId = ensured.contact?.id ?? null;
          if (ensured.created) contactsCreated += 1;
          else contactsMatched += 1;
          // ensureCrmContactPersisted persists CRM state via upsertBusinessOSInstallation;
          // refresh our in-memory installation so the gmailInbox write below doesn't clobber it.
          workingInstallation = {
            ...workingInstallation,
            configuration: { ...(workingInstallation.configuration ?? {}), crm: ensured.crm },
          };
        } catch {
          // Non-fatal: still store the message without a linked person.
        }
      }
      enrichedMessages.push({ ...record, personId, syncedAt: this._nowISO() });
    }

    const { state: mergedInbox, added } = mergeInboundMessages(currentInbox, enrichedMessages);

    const nowISO = this._nowISO();
    const persisted = await writeGmailInboxState({
      platformStore,
      installation: workingInstallation,
      inbox: mergedInbox,
      sync: {
        lastSyncAt: nowISO,
        lastSyncOk: true,
        lastSyncError: fetchErrors.length ? `${fetchErrors.length} message(s) failed to fetch` : null,
        messageCount: mergedInbox.messages.length,
      },
      actorId,
    });

    return deepFreeze({
      ok: true,
      businessId: String(businessId),
      fetched: fetched.length,
      added,
      skippedAlreadySynced: (listing.messages ?? []).length - candidateIds.length,
      fetchErrors,
      contactsCreated,
      contactsMatched,
      totalStoredMessages: persisted.inbox.messages.length,
      syncedAt: nowISO,
    });
  }

  async #recordSyncFailure({ platformStore, installation, actorId, message }) {
    try {
      const currentInbox = readGmailInboxState(installation);
      await writeGmailInboxState({
        platformStore,
        installation,
        inbox: currentInbox,
        sync: {
          lastSyncAt: this._nowISO(),
          lastSyncOk: false,
          lastSyncError: message,
        },
        actorId,
      });
    } catch {
      // Best-effort — do not mask the original error with a persistence failure.
    }
  }
}
