import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { createTeamViewModel } from "./TeamViewModel.js";
import { createTeamMemberView } from "./TeamMemberView.js";
import { createTeamDepartmentView } from "./TeamDepartmentView.js";
import { createTeamWorkloadView } from "./TeamWorkloadView.js";
import { createTeamAttentionView } from "./TeamAttentionView.js";
import { validateTeamViewModel } from "./TeamViewValidator.js";
import { createTeamActionView } from "./TeamActionView.js";
import { ACTION_STYLE_BY_PRIORITY } from "./TeamViewDefaults.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function clampInt(n, min, max) {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function isOverloaded(member) {
  const pending = Number(member?.workload?.pendingWork ?? 0);
  const utilization = Number(member?.metrics?.utilization ?? 0);
  return pending >= 4 || utilization >= 70;
}

function isBlocked(member) {
  return String(member?.status ?? "") === "blocked";
}

function isOfflineCritical(member) {
  return String(member?.status ?? "") === "offline";
}

function priorityFromMember(member) {
  const pending = Number(member?.workload?.pendingWork ?? 0);
  const utilization = Number(member?.metrics?.utilization ?? 0);
  if (pending >= 6 || utilization >= 90) return "immediate";
  if (pending >= 4 || utilization >= 70) return "soon";
  return "later";
}

function styleForPriority(priority) {
  return ACTION_STYLE_BY_PRIORITY[String(priority) ?? "later"] ?? "neutral";
}

function createAttentionItem({ id, category, priority, summary, metadata } = {}) {
  return deepFreeze({
    id: String(id ?? ""),
    category,
    priority,
    summary: String(summary ?? ""),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  });
}

export class TeamViewAdapter {
  constructor({ nowISO } = {}) {
    this.nowISO = nowISO;
  }

  translate({
    teamRuntime,
    companyRuntime,
    missionControl,
    companyBrief,
    companyHealth,
    nowISO,
  } = {}) {
    const effectiveNowISO = nowISO ?? this.nowISO ?? "2026-07-01T00:00:00.000Z";
    if (!teamRuntime) throw new Error("TeamViewAdapter.translate requires teamRuntime.");
    if (!companyRuntime) throw new Error("TeamViewAdapter.translate requires companyRuntime.");

    const companyId = String(
      missionControl?.companyId ??
        companyBrief?.companyId ??
        companyHealth?.companyId ??
        companyRuntime?.getCompany?.()?.companyName ??
        "company",
    );

    const members = safeArray(teamRuntime.getMembers?.());
    const departments = safeArray(teamRuntime.getDepartments?.());
    const roles = safeArray(teamRuntime.getRoles?.());
    const metrics = teamRuntime.getMetrics?.();

    // Index lookups.
    const deptById = new Map(departments.map((d) => [String(d.id), d]));
    const roleById = new Map(roles.map((r) => [String(r.id), r]));

    // Workload from team metrics.
    const totalAssignedWork = Number(metrics?.assignedWork ?? 0);
    const totalPendingWork = Number(metrics?.pendingWork ?? 0);
    const totalCompletedWork = Number(metrics?.completedWork ?? 0);

    const workload = createTeamWorkloadView({
      totalMembers: members.length,
      activeMembers: members.filter((m) => ["available", "busy"].includes(String(m.status))).length,
      blockedMembers: members.filter((m) => isBlocked(m)).length,
      availableMembers: members.filter((m) => String(m.status) === "available").length,
      busyMembers: members.filter((m) => String(m.status) === "busy").length,
      offlineMembers: members.filter((m) => String(m.status) === "offline").length,
      totalAssignedWork,
      totalPendingWork,
      totalCompletedWork,
      utilization: Number(metrics?.utilization ?? 0),
      metadata: deepFreeze({ derivedFrom: { teamRuntime: true } }),
    });

    // Work queue waiting too long detection.
    const workQueueItems = safeArray(companyRuntime.getWorkQueue?.());
    const now = new Date(effectiveNowISO).getTime();
    const oldCutoffMs = 72 * 60 * 60 * 1000; // 3 days
    const workWaitingTooLong = workQueueItems
      .filter((w) => String(w.status ?? "") === "Needs Review" && w.createdTimeISO)
      .filter((w) => now - new Date(String(w.createdTimeISO)).getTime() >= oldCutoffMs);

    const pendingApprovalsDecision = safeArray(companyBrief?.decisionsWaiting).find((d) => String(d?.id ?? "") === "decision_approve_communications");
    const pendingApprovalsCount = Number(pendingApprovalsDecision?.metadata?.pendingApprovalCommunications ?? 0);

    const failedCommunicationRisks = safeArray(companyBrief?.risks).filter((r) => String(r?.id ?? "") === "risk_communication_failures");

    // Departments views.
    const deptViews = departments.map((d) => {
      const deptMembers = members.filter((m) => String(m.departmentId) === String(d.id));
      const memberCount = deptMembers.length;
      const activeCount = deptMembers.filter((m) => ["available", "busy"].includes(String(m.status))).length;
      const blockedCount = deptMembers.filter((m) => isBlocked(m)).length;
      const assigned = deptMembers.reduce((sum, m) => sum + Number(m?.metrics?.assignedWork ?? 0), 0);
      const pending = deptMembers.reduce((sum, m) => sum + Number(m?.metrics?.pendingWork ?? 0), 0);
      const completed = deptMembers.reduce((sum, m) => sum + Number(m?.metrics?.completedWork ?? 0), 0);
      const capacity = deptMembers.reduce((sum, m) => sum + Number(m?.metrics?.capacity ?? m?.capacity ?? 0), 0);
      const utilization = capacity > 0 ? (assigned / capacity) * 100 : 0;

      const status = activeCount === 0 ? "critical" : blockedCount > 0 ? "needs_attention" : "healthy";

      const actions = [];
      if (activeCount === 0) {
        actions.push(createTeamActionView({ id: "hire_employee", label: "Hire Employee", type: "TEAM", target: String(d.id), priority: "immediate" }));
        actions.push(createTeamActionView({ id: "assign_work", label: "Assign Work", type: "TEAM", target: String(d.id), priority: "soon" }));
      } else if (blockedCount > 0) {
        actions.push(createTeamActionView({ id: "investigate_blocker", label: "Investigate Blocker", type: "TEAM", target: String(d.id), priority: "immediate" }));
      }

      return createTeamDepartmentView({
        id: String(d.id),
        name: String(d.name),
        summary: `${activeCount} active member(s), ${blockedCount} blocked.`,
        status,
        memberCount,
        activeCount,
        blockedCount,
        workload: deepFreeze({ assignedWork: assigned, pendingWork: pending, completedWork: completed, utilization }),
        members: deepFreeze(deptMembers.map((m) => String(m.id))),
        actions,
        metadata: deepFreeze({ deptId: d.id }),
      });
    });

    // Member views + attention.
    const attentionItems = [];
    const memberViews = members.map((m) => {
      const dept = deptById.get(String(m.departmentId)) ?? { id: String(m.departmentId), name: "" };
      const role = roleById.get(String(m.roleId)) ?? { id: String(m.roleId), name: "" };

      const overloaded = isOverloaded(m);
      const blocked = isBlocked(m);
      const offlineCritical = isOfflineCritical(m);
      const attentionRequired = Boolean(overloaded || blocked || offlineCritical);

      if (blocked) {
        attentionItems.push(
          createAttentionItem({
            id: `att_blocked_${m.id}`,
            category: "blocked_members",
            priority: "immediate",
            summary: `${String(m.name)} is blocked.`,
            metadata: deepFreeze({ memberId: m.id }),
          }),
        );
      } else if (overloaded) {
        attentionItems.push(
          createAttentionItem({
            id: `att_overloaded_${m.id}`,
            category: "overloaded_members",
            priority: priorityFromMember(m),
            summary: `${String(m.name)} has pending work requiring review.`,
            metadata: deepFreeze({ memberId: m.id }),
          }),
        );
      } else if (offlineCritical) {
        attentionItems.push(
          createAttentionItem({
            id: `att_offline_${m.id}`,
            category: "offline_critical_members",
            priority: "immediate",
            summary: `${String(m.name)} is offline and critical coverage is missing.`,
            metadata: deepFreeze({ memberId: m.id }),
          }),
        );
      }

      // Current work mapping is deterministic but best-effort.
      const currentWork = [];

      const memberBadges = [];
      if (blocked) memberBadges.push("Blocked");
      if (offlineCritical) memberBadges.push("Offline");
      if (overloaded) memberBadges.push("Overloaded");
      if (String(m.status) === "away") memberBadges.push("Away");
      if (String(m.status) === "busy") memberBadges.push("Busy");
      if (String(m.status) === "available") memberBadges.push("Available");

      const memberActions = [];
      if (blocked || offlineCritical) {
        memberActions.push(
          createTeamActionView({
            id: `investigate_blocker_${m.id}`,
            label: "Investigate Blocker",
            type: "TEAM",
            target: m.id,
            priority: "immediate",
            disabled: false,
            metadata: deepFreeze({ memberId: m.id }),
          }),
        );
      }
      if (overloaded) {
        memberActions.push(
          createTeamActionView({
            id: `rebalance_workload_${m.id}`,
            label: "Rebalance Workload",
            type: "TEAM",
            target: m.id,
            priority: "soon",
            disabled: false,
            metadata: deepFreeze({ memberId: m.id }),
          }),
        );
        memberActions.push(
          createTeamActionView({
            id: `review_member_work_${m.id}`,
            label: "Review Member Work",
            type: "TEAM",
            target: m.id,
            priority: "soon",
            disabled: false,
            metadata: deepFreeze({ memberId: m.id }),
          }),
        );
      }

      const performanceSummary =
        blocked || offlineCritical
          ? "Needs blocker investigation to restore reliable execution."
          : overloaded
            ? "Overloaded with pending work awaiting review."
            : String(m.status) === "busy"
              ? "Busy with in-flight work."
              : String(m.status) === "away"
                ? "Away; coverage may be reduced."
                : "Available and ready to take on work.";

      return createTeamMemberView({
        id: String(m.id),
        name: String(m.name),
        memberType: String(m.memberType),
        department: { id: String(m.departmentId), name: String(dept.name) },
        role: { id: String(m.roleId), name: String(role.name) },
        status: String(m.status),
        availability: Number(m.availability ?? 0),
        workload: {
          assignedWork: Number(m.workload?.assignedWork ?? 0),
          pendingWork: Number(m.workload?.pendingWork ?? 0),
          completedWork: Number(m.workload?.completedWork ?? 0),
        },
        capacity: Number(m.capacity ?? m.metrics?.capacity ?? 0),
        currentWork: currentWork,
        attentionRequired,
        performanceSummary,
        badges: memberBadges,
        actions: memberActions,
        metadata: deepFreeze({ memberId: m.id }),
      });
    });

    // Department no coverage attention items.
    const deptNoCoverage = deptViews.filter((dv) => String(dv.status) === "critical");
    for (const dv of deptNoCoverage) {
      attentionItems.push(
        createAttentionItem({
          id: `att_dept_no_coverage_${dv.id}`,
          category: "departments_no_active_coverage",
          priority: "immediate",
          summary: `${String(dv.name)} has no active coverage.`,
          metadata: deepFreeze({ departmentId: dv.id }),
        }),
      );
    }

    // Pending approvals attention.
    if (pendingApprovalsCount > 0) {
      attentionItems.push(
        createAttentionItem({
          id: "att_pending_approvals",
          category: "pending_approvals",
          priority: "immediate",
          summary: `${pendingApprovalsCount} pending approval(s) owned by the team.`,
          metadata: deepFreeze({ count: pendingApprovalsCount }),
        }),
      );
    }

    // Failed communications attention.
    if (failedCommunicationRisks.length > 0) {
      attentionItems.push(
        createAttentionItem({
          id: "att_failed_communications",
          category: "failed_communications",
          priority: "soon",
          summary: `Communication failures require follow-up.`,
          metadata: deepFreeze({ riskIds: failedCommunicationRisks.map((r) => String(r.id)) }),
        }),
      );
    }

    // Work waiting too long.
    if (workWaitingTooLong.length > 0) {
      attentionItems.push(
        createAttentionItem({
          id: "att_work_waiting_too_long",
          category: "work_waiting_too_long",
          priority: "immediate",
          summary: `${workWaitingTooLong.length} work item(s) waiting too long for review.`,
          metadata: deepFreeze({ count: workWaitingTooLong.length }),
        }),
      );
    }

    const attention = createTeamAttentionView({
      summary: attentionItems.length ? `${attentionItems.length} attention item(s) detected.` : "No team attention items detected.",
      items: attentionItems,
      metadata: deepFreeze({ derivedFrom: { brief: Boolean(companyBrief), team: true } }),
    });

    // Recommendations/actions from attention items (deduped).
    const actionCandidates = [];
    const addAction = (action) => actionCandidates.push(action);

    for (const it of attentionItems) {
      switch (it.category) {
        case "blocked_members":
        case "offline_critical_members": {
          addAction(
            createTeamActionView({
              id: "investigate_blocker",
              label: "Investigate Blocker",
              type: "TEAM",
              target: "team",
              priority: "immediate",
              disabled: false,
              metadata: deepFreeze({ derivedFrom: it.id }),
            }),
          );
          break;
        }
        case "overloaded_members": {
          addAction(
            createTeamActionView({
              id: "rebalance_workload",
              label: "Rebalance Workload",
              type: "TEAM",
              target: "team",
              priority: "soon",
              disabled: false,
              metadata: deepFreeze({ derivedFrom: it.id }),
            }),
          );
          addAction(
            createTeamActionView({
              id: "review_member_work",
              label: "Review Member Work",
              type: "TEAM",
              target: "team",
              priority: "soon",
              disabled: false,
              metadata: deepFreeze({ derivedFrom: it.id }),
            }),
          );
          break;
        }
        case "pending_approvals": {
          addAction(
            createTeamActionView({
              id: "review_pending_approvals",
              label: "Review Pending Approvals",
              type: "TEAM",
              target: "approvals",
              priority: "immediate",
              disabled: false,
              metadata: deepFreeze({ derivedFrom: it.id }),
            }),
          );
          break;
        }
        case "failed_communications": {
          addAction(
            createTeamActionView({
              id: "investigate_blocker",
              label: "Investigate Blocker",
              type: "TEAM",
              target: "communications",
              priority: "soon",
              disabled: false,
              metadata: deepFreeze({ derivedFrom: it.id }),
            }),
          );
          break;
        }
        case "work_waiting_too_long": {
          addAction(
            createTeamActionView({
              id: "review_member_work",
              label: "Review Member Work",
              type: "TEAM",
              target: "work_queue",
              priority: "immediate",
              disabled: false,
              metadata: deepFreeze({ derivedFrom: it.id }),
            }),
          );
          break;
        }
        case "departments_no_active_coverage": {
          addAction(
            createTeamActionView({
              id: "hire_employee",
              label: "Hire Employee",
              type: "TEAM",
              target: "department",
              priority: "immediate",
              disabled: false,
              metadata: deepFreeze({ derivedFrom: it.id }),
            }),
          );
          break;
        }
        default:
          break;
      }
    }

    const uniqueActionsById = new Map();
    for (const a of actionCandidates) {
      if (!a?.id) continue;
      const key = String(a.id);
      if (!uniqueActionsById.has(key)) uniqueActionsById.set(key, a);
    }
    const recommendations = Array.from(uniqueActionsById.values()).sort((a, b) => String(a.priority).localeCompare(String(b.priority)) || String(a.id).localeCompare(String(b.id)));

    const summary = (() => {
      const overloadCount = attentionItems.filter((x) => x.category === "overloaded_members").length;
      const blockedCount = attentionItems.filter((x) => x.category === "blocked_members").length;
      const waitingCount = attentionItems.filter((x) => x.category === "work_waiting_too_long").length;
      if (overloadCount + blockedCount + waitingCount === 0) return "Team workload looks stable. No immediate attention required.";
      const parts = [];
      if (blockedCount > 0) parts.push(`${blockedCount} blocked member(s)`);
      if (overloadCount > 0) parts.push(`${overloadCount} overloaded member(s)`);
      if (waitingCount > 0) parts.push(`${waitingCount} work waiting too long`);
      return `Team attention required: ${parts.join(", ")}.`;
    })();

    const vm = createTeamViewModel({
      viewId: `team_view_${companyId}_${effectiveNowISO}`,
      companyId,
      generatedAt: effectiveNowISO,
      summary,
      members: memberViews,
      departments: deptViews,
      workload,
      attention,
      recommendations,
      metadata: deepFreeze({ derivedFrom: { teamRuntime: true } }),
    });

    validateTeamViewModel(vm);
    return vm;
  }
}

