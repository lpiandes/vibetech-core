function pickPrimaryEmployee(employees) {
  if (!Array.isArray(employees) || !employees.length) return null;

  let best = employees[0];
  for (const e of employees) {
    const waiting = e?.currentWorkload?.waitingOnYouCount ?? 0;
    const bestWaiting = best?.currentWorkload?.waitingOnYouCount ?? 0;
    if (waiting > bestWaiting) best = e;
  }

  return best;
}

function toActivityContract(activity) {
  return {
    timestampISO: activity.timestampISO,
    text: `${activity.employee} ${activity.action} ${activity.object}`,
    category: activity.action,
    // Optional structured fields for frontend convenience.
    employee: activity.employee,
    action: activity.action,
    object: activity.object,
  };
}

function toWorkItemContract(item) {
  return {
    id: item.workItemId,
    title: item.title,
    clientName: item.clientName,
    matterType: item.matterType,
    priority: item.priority,
    status: item.status,
    assignedEmployeeName: item.assignedEmployeeName,
    createdTimeISO: item.createdTimeISO,
  };
}

export class WorkspaceViewAdapter {
  /**
   * @param {object} params
   * @param {CompanyWorkspaceRuntime} params.runtime
   */
  constructor({ runtime } = {}) {
    if (!runtime) throw new Error("WorkspaceViewAdapter requires `runtime`.");
    this.runtime = runtime;
  }

  getDashboardView() {
    const company = this.runtime.getCompany();
    const metrics = this.runtime.getMetrics();
    const activities = this.runtime.getActivities();
    const employees = this.runtime.getEmployees();

    const primaryEmployee = pickPrimaryEmployee(employees);

    const impactMetrics = {
      hoursSaved: metrics.hoursSavedToday,
      draftsCreatedToday: metrics.completedToday,
      pendingReviews: metrics.pendingReviews,
      estimatedValueCreatedK: Math.round((metrics.hoursSavedToday ?? 0) / 1000),
    };

    const greeting = `Good morning.`;

    const recentActivity = Array.isArray(activities)
      ? activities.map(toActivityContract)
      : [];

    const activityFeed = Array.isArray(activities)
      ? activities
          .map((a) => {
            const time = new Date(a.timestampISO).toISOString().slice(11, 16);
            return {
              time,
              employee: a.employee,
              activity: a.action,
              object: a.object,
            };
          })
          .sort((x, y) => x.time.localeCompare(y.time))
      : [];

    return {
      greeting,
      completedTasksWhileAway: metrics.completedToday,
      itemsRequiringReview: metrics.pendingReviews,
      estimatedReviewTimeMinutes: 0,
      impactMetrics,
      digitalWorkforceCard: {
        employeeName: primaryEmployee?.employeeName ?? "",
        status: primaryEmployee?.status ?? "Offline",
        todayActivitySummary:
          primaryEmployee?.todayAccomplishmentLine ?? "No recent activity yet.",
      },
      recentActivity,
      activityFeed,
      company,
    };
  }

  getDigitalWorkforceView() {
    const metrics = this.runtime.getMetrics();
    const employees = this.runtime.getEmployees() ?? [];

    const employeesWorkingCount = employees.filter(
      (e) => e.status === "Working" || e.status === "Needs Review",
    ).length;
    const employeesNeedingReviewCount = employees.filter(
      (e) => (e.currentWorkload?.waitingOnYouCount ?? 0) > 0,
    ).length;
    const employeesOfflineCount = employees.filter(
      (e) => e.status === "Offline",
    ).length;

    const workforceState =
      employeesOfflineCount === employees.length
        ? "Offline"
        : employeesNeedingReviewCount > 0
          ? "Needs Review"
          : "Employees Working";

    const workforceSummary = {
      workforceState,
      employeesWorkingCount,
      employeesNeedingReviewCount,
      employeesOfflineCount,
      todayTasksCompletedCount: metrics.completedToday,
      hoursSavedToday: metrics.hoursSavedToday,
      estimatedReviewTimeMinutes: 0,
    };

    const mappedEmployees = employees.map((e) => ({
      employeeId: e.employeeId,
      name: e.employeeName,
      role: e.role,
      status: e.status,
      statusQualifier: e.statusQualifier,
      todayCompletedCount: e.todayCompletedCount,
      todayAccomplishmentLine: e.todayAccomplishmentLine,
      approvalRatePercent: e.approvalRatePercent,
      approvalRateFootnote: e.approvalRateFootnote,
      currentWorkload: e.currentWorkload,
      capabilities: e.capabilities,
      primaryActionLabel: e.primaryActionLabel,
    }));

    return {
      workforceSummary,
      employees: mappedEmployees,
    };
  }

  getWorkQueueView() {
    const metrics = this.runtime.getMetrics();
    const queue = this.runtime.getWorkQueue() ?? [];
    const employees = this.runtime.getEmployees() ?? [];

    const anyOnline = employees.some((e) => e.status !== "Offline");

    const reviewQueueState = !anyOnline
      ? "Offline"
      : queue.length === 0
        ? "No Work"
        : "Needs Review";

    const items = queue.map(toWorkItemContract);

    const lastUpdatedISO = (() => {
      const timestamps = items.map((i) => i.createdTimeISO).filter(Boolean);
      const max = timestamps
        .map((t) => new Date(t).getTime())
        .filter((n) => Number.isFinite(n))
        .reduce((a, b) => Math.max(a, b), 0);
      return max ? new Date(max).toISOString() : new Date().toISOString();
    })();

    return {
      reviewQueueState,
      items,
      summary: {
        itemsNeedingReview: metrics.pendingReviews,
      },
      metadata: {
        lastUpdatedISO,
      },
    };
  }
}

