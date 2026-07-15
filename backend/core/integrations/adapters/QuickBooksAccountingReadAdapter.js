/**
 * Stub accounting SoR adapter — read Memory facts only.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createAccountingReadAdapter } from "../accounting/AccountingReadAdapter.js";

export class QuickBooksAccountingReadAdapter {
  constructor({ nowISO = () => new Date().toISOString(), listRecords = null } = {}) {
    this.nowISO = typeof nowISO === "function" ? nowISO : () => String(nowISO);
    this.providerType = "quickbooks";
    this.displayName = "QuickBooks";
    this.connectionType = "accounting";
    this._reader = createAccountingReadAdapter({
      providerId: "quickbooks",
      listRecords,
    });
  }

  getSetupGuidance() {
    return deepFreeze({
      summary: "Read invoice/balance facts into Memory. Ledger UI stays in QuickBooks.",
      steps: [
        "Connect QuickBooks (or Xero) with read scope.",
        "Map customers to People.",
        "Pull balances and invoice status into Memory facts.",
      ],
      reconnectInstructions: "Reconnect OAuth if tokens expire.",
      verificationMethod: "Pull at least one Memory fact.",
      commonProblems: ["Do not expect a full general ledger in VIBETech."],
      permissionsRequested: ["accounting.read"],
      estimatedTime: "15 minutes",
    });
  }

  getCapabilities() {
    return [INTEGRATION_CAPABILITIES.READ_EXTERNAL_RECORD];
  }

  pullMemoryFacts(input) {
    return this._reader.pullMemoryFacts(input);
  }
}
