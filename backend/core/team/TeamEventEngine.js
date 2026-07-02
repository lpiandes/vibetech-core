import { SUPPORTED_TEAM_EVENT_TYPES, TEAM_EVENT_TYPES } from "./TeamEventTypes.js";
import { createTeamMember } from "./TeamMember.js";
import { createTeamDepartment } from "./TeamDepartment.js";
import { createTeamRole } from "./TeamRole.js";
import { createTeamMetrics } from "./TeamMetrics.js";
 

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const k of Object.keys(value)) deepFreeze(value[k]);
  return Object.freeze(value);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") throw new Error(`TeamEventEngine: expected ${name} to be a string.`);
}

export class TeamEventEngine {
  constructor({ runtime } = {}) {
    if (!runtime) throw new Error("TeamEventEngine requires runtime.");
    this.runtime = runtime;
  }

  apply(event) {
    if (!event || typeof event !== "object") throw new Error("TeamEventEngine: event must be an object.");
    requireString(event.id, "event.id");
    requireString(event.timestampISO, "event.timestampISO");
    requireString(event.type, "event.type");
    requireString(event.source, "event.source");
    if (!isPlainObject(event.payload)) throw new Error("TeamEventEngine: event.payload must be a plain object.");

    if (!SUPPORTED_TEAM_EVENT_TYPES.includes(event.type)) {
      throw new Error(`TeamEventEngine: Unsupported event type: ${event.type}`);
    }

    const prev = this.runtime._state;

    let members = safeClone(prev.members);
    let departments = safeClone(prev.departments);
    let roles = safeClone(prev.roles);
    let status = prev.status;
    let recommendations = prev.recommendations;

    const payload = event.payload;

    switch (event.type) {
      case TEAM_EVENT_TYPES.TEAM_MEMBER_CREATED: {
        const member = payload.member;
        if (!isPlainObject(member)) throw new Error("TEAM_MEMBER_CREATED: member payload required.");
        const created = createTeamMember(member);
        if (members.some((m) => m.id === created.id)) throw new Error("TEAM_MEMBER_CREATED: member already exists.");
        members.push(created);
        break;
      }
      case TEAM_EVENT_TYPES.TEAM_MEMBER_UPDATED: {
        const { memberId, patch } = payload;
        requireString(memberId, "payload.memberId");
        if (!isPlainObject(patch)) throw new Error("TEAM_MEMBER_UPDATED: payload.patch must be an object.");
        const idx = members.findIndex((m) => m.id === memberId);
        if (idx === -1) throw new Error("TEAM_MEMBER_UPDATED: member does not exist.");
        const updated = createTeamMember({ ...members[idx], ...patch, id: memberId });
        members[idx] = updated;
        break;
      }
      case TEAM_EVENT_TYPES.TEAM_MEMBER_ARCHIVED: {
        const { memberId } = payload;
        requireString(memberId, "payload.memberId");
        const idx = members.findIndex((m) => m.id === memberId);
        if (idx === -1) throw new Error("TEAM_MEMBER_ARCHIVED: member does not exist.");
        // Archive -> offline and set pending/assigned to 0.
        const archived = createTeamMember({
          ...members[idx],
          status: "offline",
          workload: { assignedWork: 0, completedWork: members[idx].workload.completedWork, pendingWork: 0 },
        });
        members[idx] = archived;
        break;
      }

      case TEAM_EVENT_TYPES.TEAM_STATUS_CHANGED: {
        const { memberId, status: nextStatus } = payload;
        requireString(memberId, "payload.memberId");
        requireString(nextStatus, "payload.status");
        const idx = members.findIndex((m) => m.id === memberId);
        if (idx === -1) throw new Error("TEAM_STATUS_CHANGED: member does not exist.");
        members[idx] = createTeamMember({ ...members[idx], status: nextStatus });
        // Derive runtime aggregate status from member statuses deterministically.
        status = deriveTeamAggregateStatus(members);
        break;
      }

      case TEAM_EVENT_TYPES.TEAM_WORK_ASSIGNED: {
        const { memberId, assignedDelta, pendingDelta } = payload;
        requireString(memberId, "payload.memberId");
        const idx = members.findIndex((m) => m.id === memberId);
        if (idx === -1) throw new Error("TEAM_WORK_ASSIGNED: member does not exist.");
        members[idx] = createTeamMember({
          ...members[idx],
          workload: {
            assignedWork: (members[idx].workload.assignedWork ?? 0) + Number(assignedDelta ?? 0),
            pendingWork: (members[idx].workload.pendingWork ?? 0) + Number(pendingDelta ?? 0),
            completedWork: members[idx].workload.completedWork ?? 0,
          },
          status: "busy",
        });
        recommendations = recommendations;
        break;
      }

      case TEAM_EVENT_TYPES.TEAM_WORK_COMPLETED: {
        const { memberId, completedDelta, pendingDelta } = payload;
        requireString(memberId, "payload.memberId");
        const idx = members.findIndex((m) => m.id === memberId);
        if (idx === -1) throw new Error("TEAM_WORK_COMPLETED: member does not exist.");
        members[idx] = createTeamMember({
          ...members[idx],
          workload: {
            assignedWork: Math.max(0, (members[idx].workload.assignedWork ?? 0) - Number(pendingDelta ?? 0)),
            pendingWork: Math.max(0, (members[idx].workload.pendingWork ?? 0) - Number(pendingDelta ?? 0)),
            completedWork: (members[idx].workload.completedWork ?? 0) + Number(completedDelta ?? 0),
          },
          status: "available",
        });
        break;
      }

      case TEAM_EVENT_TYPES.TEAM_DEPARTMENT_CREATED: {
        const { department } = payload;
        if (!isPlainObject(department)) throw new Error("TEAM_DEPARTMENT_CREATED: department required.");
        const created = createTeamDepartment(department);
        if (departments.some((d) => d.id === created.id)) throw new Error("TEAM_DEPARTMENT_CREATED: department exists.");
        departments.push(created);
        break;
      }

      case TEAM_EVENT_TYPES.TEAM_ROLE_CREATED: {
        const { role } = payload;
        if (!isPlainObject(role)) throw new Error("TEAM_ROLE_CREATED: role required.");
        const created = createTeamRole(role);
        if (roles.some((r) => r.id === created.id)) throw new Error("TEAM_ROLE_CREATED: role exists.");
        roles.push(created);
        break;
      }

      default: {
        throw new Error(`TeamEventEngine: Unhandled event type: ${event.type}`);
      }
    }

    const nextMetrics = deriveTeamMetricsFromMembers(members);
    const nextState = deepFreeze({
      ...prev,
      members: deepFreeze(members),
      departments: deepFreeze(departments),
      roles: deepFreeze(roles),
      status,
      metrics: nextMetrics,
      recommendations,
    });

    this.runtime._state = nextState;
  }
}

function safeClone(arr) {
  return Array.isArray(arr) ? [...arr] : [];
}

function deriveTeamAggregateStatus(members) {
  // Priority order: blocked > offline > away > busy > available
  const order = ["blocked", "offline", "away", "busy", "available"];
  const statusRanks = new Map(order.map((s, i) => [s, i]));
  let best = "available";
  let bestRank = statusRanks.get(best) ?? 99;
  for (const m of members) {
    const s = String(m?.status ?? "available");
    const r = statusRanks.get(s) ?? 99;
    if (r < bestRank) {
      bestRank = r;
      best = s;
    }
  }
  return best;
}

function deriveTeamMetricsFromMembers(members) {
  const totals = members.reduce(
    (acc, m) => {
      acc.assignedWork += Number(m?.metrics?.assignedWork ?? m?.workload?.assignedWork ?? 0);
      acc.completedWork += Number(m?.metrics?.completedWork ?? m?.workload?.completedWork ?? 0);
      acc.pendingWork += Number(m?.metrics?.pendingWork ?? m?.workload?.pendingWork ?? 0);
      acc.capacity += Number(m?.metrics?.capacity ?? m?.capacity ?? 0);
      acc.utilizationSum += Number(m?.metrics?.utilization ?? 0);
      acc.availabilitySum += Number(m?.metrics?.availability ?? 0);
      return acc;
    },
    {
      assignedWork: 0,
      completedWork: 0,
      pendingWork: 0,
      capacity: 0,
      utilizationSum: 0,
      availabilitySum: 0,
    },
  );

  const count = members.length || 1;
  const utilization = totals.capacity > 0 ? (totals.assignedWork / totals.capacity) * 100 : 0;
  const availability = totals.availabilitySum / count;

  return createTeamMetrics({
    assignedWork: totals.assignedWork,
    completedWork: totals.completedWork,
    pendingWork: totals.pendingWork,
    capacity: totals.capacity,
    utilization,
    availability,
  });
}

