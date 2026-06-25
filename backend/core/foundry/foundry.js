import readline from "node:readline";
import path from "node:path";
import process from "node:process";

import { FoundryService } from "./FoundryService.js";

function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(String(answer)));
  });
}

function parseCommaSeparatedList(input) {
  return String(input)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseKpis(input) {
  const items = parseCommaSeparatedList(input);
  if (items.length === 0) return [];

  /** @type {Array<string|{name:string,target?:string,unit?:string}>} */
  const kpis = [];

  for (const item of items) {
    // Supported formats (per KPI item):
    // - name
    // - name|target
    // - name|target|unit
    // - name:target:unit
    // - name:target
    const normalized = item.trim();

    let parts = null;
    if (normalized.includes("|")) {
      parts = normalized.split("|").map((p) => p.trim());
    } else if (normalized.includes(":")) {
      parts = normalized.split(":").map((p) => p.trim());
    }

    if (!parts) {
      kpis.push(normalized);
      continue;
    }

    const [name, target, unit] = parts;
    if (!name) continue;

    const obj = { name };
    if (target) obj.target = target;
    if (unit) obj.unit = unit;
    kpis.push(obj);
  }

  return kpis;
}

function parseBusinessROI(input) {
  const raw = String(input).trim();
  if (!raw) return null;

  // Accept formats:
  // - "5000"
  // - "5000 USD"
  // - "5000, USD" (commas are stripped by the caller; keep simple here)
  const tokens = raw.split(/\s+/);
  const value = Number.parseFloat(tokens[0]);
  const currency = tokens.length >= 2 ? tokens.slice(1).join(" ") : undefined;

  if (Number.isNaN(value)) return null;
  if (!currency) return value;
  return { value, currency };
}

function parseBooleanYN(input) {
  const v = String(input).trim().toLowerCase();
  if (["y", "yes", "true", "1"].includes(v)) return true;
  if (["n", "no", "false", "0"].includes(v)) return false;
  return null;
}

async function main() {
  const rl = createReadlineInterface();

  try {
    console.log("Welcome to the VIBETech Foundry\n");

    const employeeName = await ask(rl, "Employee Name: ");
    const operatingSystem = await ask(rl, "Operating System: ");
    const department = await ask(rl, "Department: ");

    const mission = await ask(rl, "Mission: ");
    const businessOutcome = await ask(rl, "Business Outcome: ");

    const requiresHumanApprovalRaw = await ask(
      rl,
      "Requires Human Approval? (y/n): "
    );
    const requiresHumanApproval = parseBooleanYN(requiresHumanApprovalRaw);

    if (requiresHumanApproval === null) {
      console.log("\nCould not interpret Requires Human Approval. Use y/n.");
      process.exitCode = 1;
      return;
    }

    let approverRole = "";
    if (requiresHumanApproval) {
      approverRole = await ask(rl, "Approver Role: ");
    }

    const skillsRaw = await ask(rl, "Skills (comma-separated): ");
    const skills = parseCommaSeparatedList(skillsRaw);

    const trainingTopicsRaw = await ask(rl, "Training Topics (comma-separated): ");
    const trainingTopics = parseCommaSeparatedList(trainingTopicsRaw);

    const kpisRaw = await ask(
      rl,
      "KPIs (comma-separated). Format per KPI: name|target|unit (target/unit optional) or name:target:unit\nKPIs: "
    );
    const kpis = parseKpis(kpisRaw);

    const businessROIString = await ask(
      rl,
      "Business ROI (e.g. 5000 or '5000 USD'): "
    );
    const businessROI = parseBusinessROI(businessROIString);

    const futureResponsibilitiesRaw = await ask(
      rl,
      "Future Responsibilities (comma-separated): "
    );
    const futureResponsibilities = parseCommaSeparatedList(futureResponsibilitiesRaw);

    // EmployeeDefinitionEngine requires jobTitle. This CLI collects business fields only,
    // so we derive a reasonable jobTitle default without asking extra questions.
    const jobTitle = `${department} Digital Employee`;

    const employeeDefinition = {
      employeeName: employeeName.trim(),
      jobTitle,
      operatingSystem: operatingSystem.trim(),
      department: department.trim(),
      mission: mission.trim(),
      businessOutcome: businessOutcome.trim(),

      requiresHumanApproval,
      approverRole: requiresHumanApproval ? approverRole.trim() : "",

      skills,
      trainingTopics,
      kpis,
      businessROI,
      futureResponsibilities,
    };

    const employeesRootPath = path.resolve(process.cwd(), "..", "..", "..", "employees");
    const service = new FoundryService({ employeesRootPath });

    const result = await service.createEmployee(employeeDefinition);

    console.log("\n=== Result ===");
    console.log(`Success: ${result.success}`);

    if (!result.success) {
      console.log("\nWarnings:");
      console.log(JSON.stringify(result.warnings ?? [], null, 2));

      console.log("\nRecommendations:");
      console.log(JSON.stringify(result.recommendations ?? [], null, 2));

      console.log("\nValidation Errors:");
      console.log(JSON.stringify(result.validation?.errors ?? [], null, 2));
    } else {
      console.log("\nWarnings:");
      console.log(JSON.stringify(result.warnings ?? [], null, 2));

      console.log("\nRecommendations:");
      console.log(JSON.stringify(result.recommendations ?? [], null, 2));

      console.log("\nGenerated Employee Folder:");
      console.log(JSON.stringify(result.generatedFiles, null, 2));
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

