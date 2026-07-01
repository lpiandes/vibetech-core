import { createCommunication } from "./Communication.js";
import {
  COMMUNICATION_CHANNELS,
  COMMUNICATION_STATUSES,
  SUPPORTED_COMMUNICATION_STATUSES,
} from "./CommunicationTypes.js";
import { COMPANY_EVENT_TYPES } from "../company/events/CompanyEventTypes.js";
import { createCompanyEvent } from "../company/events/CompanyEvent.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }
  return Object.freeze(value);
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`CommunicationEngine: expected ${name} to be a non-empty string.`);
  }
}

function requireISO(value, name) {
  if (typeof value !== "string") {
    throw new Error(`CommunicationEngine: expected ${name} to be an ISO string.`);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`CommunicationEngine: expected ${name} to be a valid ISO string.`);
  }
}

function nowISO(provided) {
  return typeof provided === "string" ? new Date(provided).toISOString() : new Date().toISOString();
}

function actionLabelForStatus(status) {
  switch (status) {
    case COMMUNICATION_STATUSES.DRAFT:
      return "Draft Created";
    case COMMUNICATION_STATUSES.PENDING_APPROVAL:
      return "Review Required";
    case COMMUNICATION_STATUSES.APPROVED:
      return "Approved";
    case COMMUNICATION_STATUSES.SENDING:
      return "Sending";
    case COMMUNICATION_STATUSES.SENT:
      return "Sent";
    case COMMUNICATION_STATUSES.DELIVERED:
      return "Delivered";
    case COMMUNICATION_STATUSES.OPENED:
      return "Opened";
    case COMMUNICATION_STATUSES.REPLIED:
      return "Replied";
    case COMMUNICATION_STATUSES.FAILED:
      return "Failed";
    default:
      return "Updated";
  }
}

export class CommunicationEngine {
  /**
   * @param {object} params
   * @param {CompanyWorkspaceRuntime} params.runtime
   */
  constructor({ runtime } = {}) {
    if (!runtime) throw new Error("CommunicationEngine requires runtime.");
    this.runtime = runtime;
  }

  getCommunicationOrThrow(communicationId) {
    requireString(communicationId, "communicationId");
    const comms = this.runtime.getCommunications?.() ?? [];
    const found = comms.find((c) => c.communicationId === communicationId);
    if (!found) {
      throw new Error(`CommunicationEngine: communication not found: ${communicationId}`);
    }
    return found;
  }

  _upsertCommunication(updatedCommunication) {
    const prev = this.runtime.getCommunications?.() ?? [];
    const next = [
      ...prev.filter((c) => c.communicationId !== updatedCommunication.communicationId),
      updatedCommunication,
    ];

    // Runtime is in-memory + deterministic; freeze for safety.
    // We update company runtime directly (required by spec: update company runtime).
    this.runtime._state = deepFreeze({
      ...this.runtime._state,
      communications: deepFreeze(next),
    });
  }

  _logActivity({ communicationId, status, action, timestampISO, object }) {
    const activity = {
      timestampISO,
      employee: "Communication Engine",
      action,
      object: object ?? communicationId,
      status,
    };
    const event = createCompanyEvent({
      id: `activity_comm_${communicationId}_${Date.now()}`,
      timestampISO,
      type: COMPANY_EVENT_TYPES.ACTIVITY_CREATED,
      source: "communication-engine",
      payload: { activity },
    });
    this.runtime.applyEvent(event);
  }

  /**
   * Creates a DRAFT communication and stores it in company runtime.
   */
  createDraft({
    communicationId,
    channel,
    recipient,
    subject,
    body,
    reviewRequired,
    createdAtISO,
  } = {}) {
    requireString(communicationId, "communicationId");
    requireString(recipient, "recipient");
    requireString(subject, "subject");
    requireString(body, "body");

    if (!Object.values(COMMUNICATION_CHANNELS).includes(channel)) {
      throw new Error(`CommunicationEngine: invalid channel: ${channel}`);
    }

    const timestamp = nowISO(createdAtISO);
    if (reviewRequired !== undefined && typeof reviewRequired !== "boolean") {
      throw new Error("CommunicationEngine: reviewRequired must be boolean.");
    }

    const shouldRequireApproval = Boolean(reviewRequired);
    const initialStatus = shouldRequireApproval
      ? COMMUNICATION_STATUSES.PENDING_APPROVAL
      : COMMUNICATION_STATUSES.DRAFT;

    const timeline = [
      {
        timestampISO: timestamp,
        status: COMMUNICATION_STATUSES.DRAFT,
        action: actionLabelForStatus(COMMUNICATION_STATUSES.DRAFT),
        object: recipient,
      },
      ...(shouldRequireApproval
        ? [
            {
              timestampISO: timestamp,
              status: COMMUNICATION_STATUSES.PENDING_APPROVAL,
              action: actionLabelForStatus(
                COMMUNICATION_STATUSES.PENDING_APPROVAL,
              ),
              object: recipient,
            },
          ]
        : []),
    ];

    const comm = createCommunication({
      communicationId,
      channel,
      status: initialStatus,
      subject,
      body,
      recipient,
      createdAt: timestamp,
      reviewRequired: shouldRequireApproval,
      timeline,
    });

    this._upsertCommunication(comm);

    // Log both steps when review is required.
    this._logActivity({
      communicationId,
      status: COMMUNICATION_STATUSES.DRAFT,
      action: actionLabelForStatus(COMMUNICATION_STATUSES.DRAFT),
      timestampISO: timestamp,
      object: recipient,
    });
    if (shouldRequireApproval) {
      this._logActivity({
        communicationId,
        status: COMMUNICATION_STATUSES.PENDING_APPROVAL,
        action: actionLabelForStatus(COMMUNICATION_STATUSES.PENDING_APPROVAL),
        timestampISO: timestamp,
        object: recipient,
      });
    }

    return this.getCommunicationOrThrow(communicationId);
  }

  approveCommunication({ communicationId, approvedBy, approvedAtISO } = {}) {
    requireString(communicationId, "communicationId");
    requireString(approvedBy ?? "governance", "approvedBy");

    const comm = this.getCommunicationOrThrow(communicationId);
    if (![COMMUNICATION_STATUSES.DRAFT, COMMUNICATION_STATUSES.PENDING_APPROVAL].includes(comm.status)) {
      throw new Error(
        `CommunicationEngine: cannot approve communication in status=${comm.status}`,
      );
    }

    const timestamp = nowISO(approvedAtISO);
    const status = COMMUNICATION_STATUSES.APPROVED;
    const timeline = [
      ...comm.timeline,
      {
        timestampISO: timestamp,
        status,
        action: actionLabelForStatus(status),
        object: comm.recipient,
      },
    ];

    const updated = createCommunication({
      ...comm,
      status,
      approvedBy,
      reviewRequired: false,
      timeline,
    });

    this._upsertCommunication(updated);
    this._logActivity({
      communicationId,
      status,
      action: actionLabelForStatus(status),
      timestampISO: timestamp,
      object: updated.recipient,
    });

    return updated;
  }

  rejectCommunication({ communicationId, rejectedAtISO, rejectedBy } = {}) {
    requireString(communicationId, "communicationId");
    requireString(rejectedBy ?? "governance", "rejectedBy");

    const comm = this.getCommunicationOrThrow(communicationId);

    const timestamp = nowISO(rejectedAtISO);
    const status = COMMUNICATION_STATUSES.FAILED;
    const timeline = [
      ...comm.timeline,
      {
        timestampISO: timestamp,
        status,
        action: actionLabelForStatus(status),
        object: comm.recipient,
      },
    ];

    const updated = createCommunication({
      ...comm,
      status,
      approvedBy: undefined,
      reviewRequired: false,
      timeline,
    });

    this._upsertCommunication(updated);
    this._logActivity({
      communicationId,
      status,
      action: actionLabelForStatus(status),
      timestampISO: timestamp,
      object: updated.recipient,
    });

    return updated;
  }

  markSent({ communicationId, sentAtISO } = {}) {
    requireString(communicationId, "communicationId");
    const comm = this.getCommunicationOrThrow(communicationId);

    if (![COMMUNICATION_STATUSES.APPROVED].includes(comm.status)) {
      throw new Error(`CommunicationEngine: cannot send in status=${comm.status}`);
    }

    const timestamp = nowISO(sentAtISO);
    const status = COMMUNICATION_STATUSES.SENT;

    const timeline = [
      ...comm.timeline,
      {
        timestampISO: timestamp,
        status,
        action: actionLabelForStatus(status),
        object: comm.recipient,
      },
    ];

    const updated = createCommunication({
      ...comm,
      status,
      sentAt: timestamp,
      timeline,
    });

    this._upsertCommunication(updated);
    this._logActivity({
      communicationId,
      status,
      action: actionLabelForStatus(status),
      timestampISO: timestamp,
      object: updated.recipient,
    });

    return updated;
  }

  markFailed({ communicationId, failedAtISO, reason } = {}) {
    requireString(communicationId, "communicationId");
    const comm = this.getCommunicationOrThrow(communicationId);

    const t = nowISO(failedAtISO);
    const status = COMMUNICATION_STATUSES.FAILED;
    const timeline = [
      ...comm.timeline,
      {
        timestampISO: t,
        status,
        action: actionLabelForStatus(status),
        object: reason ? String(reason) : comm.recipient,
      },
    ];

    const updated = createCommunication({
      ...comm,
      status,
      timeline,
    });
    this._upsertCommunication(updated);
    this._logActivity({
      communicationId,
      status,
      action: actionLabelForStatus(status),
      timestampISO: t,
      object: updated.recipient,
    });
    return updated;
  }

  /**
   * Executes outbound delivery through a provider.
   * CommunicationEngine remains the owner of business state.
   *
   * @param {object} params
   * @param {string} params.communicationId
   * @param {EmailProvider} params.provider
   * @returns {Promise<{success:boolean, providerMessageId?:string, providerStatus?:string, communication:any, error?:any}>}
   */
  async sendCommunication({ communicationId, provider } = {}) {
    requireString(communicationId, "communicationId");
    if (!provider || typeof provider !== "object") {
      throw new Error("CommunicationEngine.sendCommunication requires a provider.");
    }

    const comm = this.getCommunicationOrThrow(communicationId);
    if (!comm) throw new Error(`CommunicationEngine: communication missing: ${communicationId}`);

    let providerMessageId;
    let providerStatus;
    let sentTimestampISO;

    try {
      if (typeof provider.connect === "function") {
        await provider.connect();
      }

      const result = await provider.send({
        communication: comm,
      });

      providerMessageId = result?.providerMessageId;
      providerStatus = result?.providerStatus;
      sentTimestampISO =
        result?.sentTimestampISO ?? result?.sentTimestamp;

      const updated = this.markSent({
        communicationId,
        sentAtISO: sentTimestampISO ?? new Date().toISOString(),
      });

      return {
        success: true,
        providerMessageId,
        providerStatus,
        communication: updated,
      };
    } catch (error) {
      const failedAtISO = new Date().toISOString();
      this.markFailed({
        communicationId,
        failedAtISO,
        reason: error?.message ?? error,
      });

      return {
        success: false,
        error,
        communication: this.getCommunicationOrThrow(communicationId),
      };
    } finally {
      if (typeof provider.disconnect === "function") {
        await provider.disconnect();
      }
    }
  }

  markDelivered({ communicationId, timestampISO } = {}) {
    requireString(communicationId, "communicationId");
    const comm = this.getCommunicationOrThrow(communicationId);

    if (![COMMUNICATION_STATUSES.SENT].includes(comm.status)) {
      throw new Error(`CommunicationEngine: cannot deliver in status=${comm.status}`);
    }

    const t = nowISO(timestampISO);
    const status = COMMUNICATION_STATUSES.DELIVERED;
    const timeline = [
      ...comm.timeline,
      { timestampISO: t, status, action: actionLabelForStatus(status), object: comm.recipient },
    ];

    const updated = createCommunication({ ...comm, status, timeline });
    this._upsertCommunication(updated);
    this._logActivity({
      communicationId,
      status,
      action: actionLabelForStatus(status),
      timestampISO: t,
      object: updated.recipient,
    });

    return updated;
  }

  markOpened({ communicationId, openedAtISO } = {}) {
    requireString(communicationId, "communicationId");
    const comm = this.getCommunicationOrThrow(communicationId);
    if (![COMMUNICATION_STATUSES.DELIVERED].includes(comm.status)) {
      throw new Error(`CommunicationEngine: cannot open in status=${comm.status}`);
    }

    const t = nowISO(openedAtISO);
    const status = COMMUNICATION_STATUSES.OPENED;
    const timeline = [
      ...comm.timeline,
      { timestampISO: t, status, action: actionLabelForStatus(status), object: comm.recipient },
    ];

    const updated = createCommunication({ ...comm, status, openedAt: t, timeline });
    this._upsertCommunication(updated);
    this._logActivity({
      communicationId,
      status,
      action: actionLabelForStatus(status),
      timestampISO: t,
      object: updated.recipient,
    });
    return updated;
  }

  markReplied({ communicationId, repliedAtISO } = {}) {
    requireString(communicationId, "communicationId");
    const comm = this.getCommunicationOrThrow(communicationId);
    if (![COMMUNICATION_STATUSES.OPENED].includes(comm.status)) {
      throw new Error(`CommunicationEngine: cannot reply in status=${comm.status}`);
    }

    const t = nowISO(repliedAtISO);
    const status = COMMUNICATION_STATUSES.REPLIED;
    const timeline = [
      ...comm.timeline,
      { timestampISO: t, status, action: actionLabelForStatus(status), object: comm.recipient },
    ];

    const updated = createCommunication({ ...comm, status, repliedAt: t, timeline });
    this._upsertCommunication(updated);
    this._logActivity({
      communicationId,
      status,
      action: actionLabelForStatus(status),
      timestampISO: t,
      object: updated.recipient,
    });
    return updated;
  }
}

