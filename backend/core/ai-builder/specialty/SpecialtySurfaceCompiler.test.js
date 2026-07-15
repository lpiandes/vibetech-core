import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compileSpecialtyEmployee,
  compileSpecialtySurfacesOnSpecification,
  specialtyAiModuleId,
} from "./SpecialtySurfaceCompiler.js";
import { isSafeModuleRoute, resolveSafeModuleHref } from "../../business-os/BusinessOSSafeRoutes.js";
import { applyPlanAdditionsToSpecification } from "../applyPlanAdditionsToSpecification.js";
import { buildBusinessOSNavigation } from "../../business-os/BusinessOSNavigationBuilder.js";
import { compileCustomAiEmployee } from "../custom-ai/CustomAiWorkerCompiler.js";
import { CustomAiWorkerService } from "../custom-ai/CustomAiWorkerService.js";
import { WorkRuntime } from "../../work/WorkRuntime.js";

describe("SpecialtySurfaceCompiler", () => {
  it("compiles owner modules and custom AIs into specialty surfaces + nav modules", () => {
    const next = compileSpecialtySurfacesOnSpecification({
      businessId: "biz_1",
      modules: [{
        moduleId: "owner_mod_practice_plans",
        label: "Practice Plans",
        ownerAdded: true,
      }],
      employeeDefinitions: [{
        employeeId: "owner_emp_workout",
        label: "Workout Builder",
        purpose: "Build workout plans",
        ownerAdded: true,
        capabilities: ["custom_ai_work"],
      }],
    }, { businessId: "biz_1" });

    const practice = next.modules.find((module) => module.moduleId === "owner_mod_practice_plans");
    assert.ok(practice);
    assert.equal(practice.surfaceKind, "module");
    assert.match(String(practice.href), /\/b\/biz_1\/specialty\/owner_mod_practice_plans/);

    const aiModuleId = specialtyAiModuleId("owner_emp_workout");
    const aiModule = next.modules.find((module) => module.moduleId === aiModuleId);
    assert.ok(aiModule);
    assert.equal(aiModule.surfaceKind, "ai_teammate");
    assert.equal(aiModule.employeeId, "owner_emp_workout");
    assert.ok(aiModule.blocks.includes("run_job"));

    const employee = next.employeeDefinitions.find((entry) => entry.employeeId === "owner_emp_workout");
    assert.match(String(employee.specialtyHref), /\/specialty\/owner_emp_workout/);
  });

  it("treats specialty module ids as safe routes", () => {
    assert.equal(isSafeModuleRoute("owner_mod_practice_plans"), true);
    assert.equal(isSafeModuleRoute("specialty_ai_owner_emp_workout"), true);
    assert.equal(isSafeModuleRoute("custom_generated_page"), false);
    assert.match(
      String(resolveSafeModuleHref("owner_mod_practice_plans", { businessId: "biz_1" })),
      /\/b\/biz_1\/specialty\/owner_mod_practice_plans/,
    );
  });

  it("includes specialty modules in navigation after plan additions", () => {
    const specification = applyPlanAdditionsToSpecification({
      businessId: "biz_1",
      modules: [{ moduleId: "work", label: "Work", primaryNavigationEligible: true, navigationPriority: 1 }],
      employeeDefinitions: [],
      capabilityRequirements: [],
    }, {
      businessId: "biz_1",
      appearance: {
        planAdditions: {
          modules: [{ id: "owner_mod_drills", label: "Drill Library" }],
          employees: [{ id: "owner_emp_coach", label: "Practice Coach", purpose: "Practice plans" }],
        },
      },
    });

    const navigation = buildBusinessOSNavigation({
      modules: specification.modules,
      businessId: "biz_1",
      navigation: { maximumPrimaryItems: 12 },
    });

    const hrefs = navigation.primaryItems.map((item) => item.href);
    assert.ok(hrefs.some((href) => String(href).includes("/specialty/owner_mod_drills")));
    assert.ok(hrefs.some((href) => String(href).includes("/specialty/owner_emp_coach")));
  });

  it("run job still creates Work for a specialty-compiled custom AI", async () => {
    const employee = compileSpecialtyEmployee(
      compileCustomAiEmployee({
        employeeId: "owner_emp_workout",
        label: "Workout Builder",
        purpose: "Build workout plans",
      }, { ownerAdded: true }),
      { businessId: "biz_1" },
    );

    assert.match(String(employee.specialtyHref), /\/specialty\/owner_emp_workout/);

    const workRuntime = new WorkRuntime({ nowISO: "2026-07-01T00:00:00.000Z" });
    const worker = new CustomAiWorkerService({ nowISO: () => "2026-07-01T12:00:00.000Z" });
    const result = await worker.runJob({
      workRuntime,
      employee,
      brief: "Build Friday practice plan",
      businessId: "biz_1",
    });

    assert.equal(result.ok, true);
    const item = workRuntime.getWorkItem(result.workItemId);
    assert.equal(item.workType, "custom_ai_task");
    assert.equal(item.assignedTo, "owner_emp_workout");
  });
});
