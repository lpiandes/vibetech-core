import assert from "node:assert/strict";
import { test } from "node:test";

import { TeamRuntime } from "../TeamRuntime.js";
import { TeamViewAdapter } from "./TeamViewAdapter.js";
import { validateTeamViewModel } from "./TeamViewValidator.js";

import { CompanyWorkspaceRuntime } from "../../company/CompanyWorkspaceRuntime.js";
import { CompanyBriefEngine } from "../../business-intelligence/company-brief/CompanyBriefEngine.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

function buildContext() {
  const teamRuntime = new TeamRuntime();
  const companyRuntime = new CompanyWorkspaceRuntime();
  const companyBrief = new CompanyBriefEngine({ nowISO: NOW0 }).generate({ companyRuntime });

  const viewAdapter = new TeamViewAdapter({ nowISO: NOW0 });
  const viewModel = viewAdapter.translate({ teamRuntime, companyRuntime, companyBrief });

  return { teamRuntime, companyRuntime, companyBrief, viewModel };
}

test("Team view generation: deterministic and deeply frozen", () => {
  const a = buildContext();
  const b = buildContext();

  assert.deepEqual(a.viewModel, b.viewModel);
  assert.ok(Object.isFrozen(a.viewModel));
  assert.ok(Object.isFrozen(a.viewModel.members));
  assert.ok(Object.isFrozen(a.viewModel.departments));
  assert.ok(Object.isFrozen(a.viewModel.workload));
  assert.ok(Object.isFrozen(a.viewModel.attention));

  assert.deepEqual(validateTeamViewModel(a.viewModel), { ok: true });
});

test("Member view: overloaded member triggers attentionRequired and actions", () => {
  const { viewModel } = buildContext();

  const member = viewModel.members.find((m) => m.id === "tm_digital_operations");
  assert.ok(member);
  assert.equal(member.attentionRequired, true);
  assert.ok(member.badges.includes("Overloaded") || member.badges.includes("Away"));

  const hasRebalance = member.actions.some((a) => a.id === `rebalance_workload_${member.id}`);
  assert.ok(hasRebalance);
});

test("Workload view: totals include all members and aggregate work", () => {
  const { viewModel, teamRuntime } = buildContext();

  assert.equal(viewModel.workload.totalMembers, teamRuntime.getMembers().length);
  assert.equal(viewModel.workload.blockedMembers, teamRuntime.getMembers().filter((m) => m.status === "blocked").length);
  assert.ok(viewModel.workload.totalPendingWork >= 0);
  assert.ok(viewModel.workload.utilization >= 0);
});

test("Attention detection: work waiting too long creates an attention item", () => {
  const { viewModel } = buildContext();

  const categories = viewModel.attention.items.map((i) => i.category);
  assert.ok(categories.includes("work_waiting_too_long"));
});

test("Department view: memberCount/activeCount are consistent", () => {
  const { viewModel, teamRuntime } = buildContext();

  const dep = viewModel.departments.find((d) => d.id === "dept_operations");
  assert.ok(dep);

  const teamMembers = teamRuntime.getMembers().filter((m) => m.departmentId === "dept_operations");
  const activeCount = teamMembers.filter((m) => ["available", "busy"].includes(m.status)).length;
  assert.equal(dep.memberCount, teamMembers.length);
  assert.equal(dep.activeCount, activeCount);
});

test("Runtime immutability: adapter does not mutate teamRuntime or companyRuntime", () => {
  const teamRuntime = new TeamRuntime();
  const companyRuntime = new CompanyWorkspaceRuntime();
  const companyBrief = new CompanyBriefEngine({ nowISO: NOW0 }).generate({ companyRuntime });

  const beforeMembers = teamRuntime.getMembers();
  const beforeState = teamRuntime._state;
  const beforeWorkQueue = companyRuntime.getWorkQueue();

  const adapter = new TeamViewAdapter({ nowISO: NOW0 });
  const vm = adapter.translate({ teamRuntime, companyRuntime, companyBrief });

  assert.ok(Object.isFrozen(beforeState));
  assert.deepEqual(teamRuntime.getMembers(), beforeMembers);
  assert.deepEqual(companyRuntime.getWorkQueue(), beforeWorkQueue);
  assert.ok(Object.isFrozen(vm));
});

