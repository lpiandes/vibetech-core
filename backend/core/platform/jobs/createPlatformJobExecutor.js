/**
 * Shared platform job executor used by the long-running worker and hosted HTTP ticks.
 */
import {
  DurableWorkflowExecutor,
} from "./PlatformJobQueue.js";
import { processSpecialtyScheduleDueJob } from "./processSpecialtyScheduleDueJob.js";
import { processCalendarReminderDueJob } from "./processCalendarReminderDueJob.js";
import { loadSpecialtyWorkerWorkspace } from "./loadSpecialtyWorkerWorkspace.js";

export function createPlatformJobExecutor({ queue, platformStore }) {
  return new DurableWorkflowExecutor({
    queue,
    sendOutbound: async (payload) => {
      const channel = String(payload?.channel ?? "email").toLowerCase();
      const businessId = String(payload?.businessId ?? payload?.workspaceId ?? "").trim();
      if (!businessId) {
        throw new Error("outbound_missing_business_id");
      }
      const loaded = await loadSpecialtyWorkerWorkspace({
        businessId,
        platformStore,
        employeeId: payload?.employeeId ?? null,
      });
      if (!loaded.ok) {
        throw new Error(loaded.reason ?? "workspace_load_failed");
      }
      const hub = loaded.integrationHub;
      if (!hub?.executeAction) {
        throw new Error("integration_hub_unavailable");
      }
      const to = String(payload?.to ?? payload?.recipient ?? "").trim();
      if (!to) throw new Error("outbound_missing_recipient");

      if (channel === "sms") {
        const sent = await hub.executeAction({
          connectionType: "sms_channel",
          capability: "SEND_SMS",
          input: {
            to,
            body: String(payload?.body ?? payload?.smsBody ?? ""),
            outboundApproved: true,
          },
        });
        if (!(sent?.ok ?? sent?.status === "SUCCESS")) {
          throw new Error(String(sent?.message ?? sent?.reason ?? "sms_send_failed"));
        }
        return { ok: true, channel, to, detail: sent };
      }

      const sent = await hub.executeAction({
        connectionType: "business_email",
        capability: "SEND_EMAIL",
        input: {
          to,
          subject: String(payload?.subject ?? payload?.emailSubject ?? "Update"),
          body: String(payload?.body ?? payload?.emailBody ?? ""),
          outboundApproved: true,
        },
      });
      if (!(sent?.ok ?? sent?.status === "SUCCESS")) {
        throw new Error(String(sent?.message ?? sent?.reason ?? "email_send_failed"));
      }
      return { ok: true, channel: "email", to, detail: sent };
    },
    runSpecialtySchedule: async (job) => {
      const employeeId = String(job?.payload?.employeeId ?? "");
      return processSpecialtyScheduleDueJob({
        job,
        queue,
        nowISO: () => new Date().toISOString(),
        loadWorkspace: async (businessId) => {
          const loaded = await loadSpecialtyWorkerWorkspace({
            businessId,
            platformStore,
            employeeId,
          });
          if (!loaded.ok) return loaded;
          return {
            ok: true,
            workRuntime: loaded.workRuntime,
            automationRuntime: loaded.automationRuntime,
            approvalRuntime: loaded.approvalRuntime,
            employee: loaded.employee,
            knowledgeDocuments: loaded.knowledgeDocuments,
            installation: loaded.installation,
            platformStore,
            persistWork: loaded.persistWork,
          };
        },
      });
    },
    runCalendarReminder: async (job) => {
      const employeeId = String(job?.payload?.employeeId ?? "emp_calendar_reminder");
      return processCalendarReminderDueJob({
        job,
        platformStore,
        nowISO: () => new Date().toISOString(),
        loadWorkspace: async (businessId) => {
          const loaded = await loadSpecialtyWorkerWorkspace({
            businessId,
            platformStore,
            employeeId,
          });
          if (!loaded.ok) return loaded;
          return {
            ok: true,
            workRuntime: loaded.workRuntime,
            automationRuntime: loaded.automationRuntime,
            approvalRuntime: loaded.approvalRuntime,
            employee: loaded.employee,
            knowledgeDocuments: loaded.knowledgeDocuments,
            installation: loaded.installation,
            platformStore,
            persistWork: loaded.persistWork,
          };
        },
      });
    },
  });
}

/**
 * Process up to `limit` due jobs (for HTTP cron / hosted ticks).
 */
export async function runPlatformJobTick({
  queue,
  platformStore,
  limit = 5,
  workerId = "http_tick",
} = {}) {
  const executor = createPlatformJobExecutor({ queue, platformStore });
  const results = [];
  const max = Math.max(1, Math.min(25, Number(limit) || 5));
  for (let i = 0; i < max; i += 1) {
    const result = await executor.processNext({ workerId: `${workerId}_${i}` });
    if (!result) break;
    results.push(result);
  }
  return {
    ok: true,
    processed: results.length,
    results,
  };
}
