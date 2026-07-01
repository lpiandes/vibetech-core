/**
 * Demo: CompanyWorkspaceRuntime
 *
 * Prints:
 * - Company
 * - Employees
 * - Metrics
 * - Activities
 * - Work queue
 * - Knowledge
 */

import { CompanyWorkspaceRuntime } from "./CompanyWorkspaceRuntime.js";

function printSection(title, value) {
  console.log(`\n=== ${title} ===`);
  console.log(
    typeof value === "string" ? value : JSON.stringify(value, null, 2),
  );
}

async function main() {
  const runtime = new CompanyWorkspaceRuntime();

  const company = runtime.getCompany();
  const employees = runtime.getEmployees();
  const metrics = runtime.getMetrics();
  const activities = runtime.getActivities();
  const queue = runtime.getWorkQueue();
  const knowledge = runtime.getKnowledge();

  printSection("Company", company);
  printSection("Employees", employees);
  printSection("Metrics", metrics);
  printSection("Activities", activities);
  printSection("Queue", queue);
  printSection("Knowledge", knowledge);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

