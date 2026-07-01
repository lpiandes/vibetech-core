/**
 * demo-workspace-view.js
 *
 * Prints workspace view adapter outputs:
 * - Dashboard View
 * - Digital Workforce View
 * - Work Queue View
 */

import { CompanyWorkspaceRuntime } from "../company/CompanyWorkspaceRuntime.js";
import { WorkspaceViewAdapter } from "./WorkspaceViewAdapter.js";

function printSection(title, value) {
  console.log(`\n=== ${title} ===`);
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

async function main() {
  const runtime = new CompanyWorkspaceRuntime();
  const adapter = new WorkspaceViewAdapter({ runtime });

  printSection("Dashboard View", adapter.getDashboardView());
  printSection("Digital Workforce View", adapter.getDigitalWorkforceView());
  printSection("Work Queue View", adapter.getWorkQueueView());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

