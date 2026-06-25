/**
 * EmployeeDefinition
 *
 * Canonical business definition contract for a Digital Employee.
 *
 * This layer intentionally does NOT expose technical implementation details:
 * - no providers
 * - no manifests
 * - no prompts
 * - no SDK internals
 *
 * It represents business intent in a normalized business-shaped structure.
 */
export class EmployeeDefinition {
  /**
   * @param {object} params
   * @param {string} params.employeeName
   * @param {string} params.jobTitle
   * @param {string} params.operatingSystem
   * @param {string} params.department
   * @param {string} params.mission
   * @param {string} params.businessOutcome
   * @param {boolean} params.requiresHumanApproval
   * @param {string} params.approverRole
   * @param {string[]} params.skills
   * @param {string[]} params.trainingTopics
   * @param {Array<string|{name:string,target?:string,unit?:string}>} params.kpis
   * @param {number|{value:number,currency?:string}} params.businessROI
   * @param {string[]} params.futureResponsibilities
   * @param {string} [params.definitionVersion]
   */
  constructor({
    employeeName,
    jobTitle,
    operatingSystem,
    department,
    mission,
    businessOutcome,
    requiresHumanApproval,
    approverRole,
    skills,
    trainingTopics,
    kpis,
    businessROI,
    futureResponsibilities,
    definitionVersion = "1.0",
  }) {
    this.definitionVersion = definitionVersion;

    this.employeeName = employeeName;
    this.jobTitle = jobTitle;
    this.operatingSystem = operatingSystem;
    this.department = department;

    this.mission = mission;
    this.businessOutcome = businessOutcome;

    this.requiresHumanApproval = requiresHumanApproval;
    this.approverRole = approverRole;

    this.skills = skills;
    this.trainingTopics = trainingTopics;
    this.kpis = kpis;
    this.businessROI = businessROI;
    this.futureResponsibilities = futureResponsibilities;
  }
}

