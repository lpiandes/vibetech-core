/**
 * demo-gmail-provider.js
 *
 * Full provider execution flow:
 * - create communication draft
 * - approve review (creates APPROVED Communication)
 * - execute Gmail provider send
 * - verify runtime status updates + activity log
 * - verify Gmail message exists in Sent folder (via labels)
 *
 * Requires Gmail OAuth env vars (see README).
 */

import { CompanyWorkspaceRuntime } from "../../core/company/CompanyWorkspaceRuntime.js";
import { CommunicationEngine } from "../../core/communication/CommunicationEngine.js";
import { GmailProvider } from "./GmailProvider.js";

function printSection(title, value) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(value, null, 2));
}

async function getGmailMessageLabelIds({ messageId }) {
  const provider = new GmailProvider();
  await provider.connect();

  const res = await provider.gmail.users.messages.get({
    userId: "me",
    id: messageId,
  });

  await provider.disconnect();

  return res?.data?.labelIds ?? [];
}

async function main() {
  const runtime = new CompanyWorkspaceRuntime();
  const communicationEngine = new CommunicationEngine({ runtime });

  const communicationId = "comm_demo_gmail_1";

  const beforeActivitiesCount = Array.isArray(runtime.getActivities())
    ? runtime.getActivities().length
    : 0;

  // 1) Create draft (requires review).
  const draft = communicationEngine.createDraft({
    communicationId,
    channel: "email",
    recipient: process.env.GMAIL_TEST_RECIPIENT ?? "me",
    subject: "VIBETech Provider Demo",
    body: "Hello from VIBETech Gmail Provider v1 (test).",
    reviewRequired: true,
    createdAtISO: new Date().toISOString(),
  });

  printSection("Initial communication", draft);

  // 2) Approve review.
  const approved = communicationEngine.approveCommunication({
    communicationId,
    approvedBy: "Governance Reviewer",
    approvedAtISO: new Date().toISOString(),
  });

  printSection("After APPROVAL", approved);

  // 3) Send through Gmail provider.
  const provider = new GmailProvider();

  const sendResult = await communicationEngine.sendCommunication({
    communicationId,
    provider,
  });

  printSection("Provider send result", sendResult);
  const sent = runtime
    .getCommunications()
    .find((c) => c.communicationId === communicationId);

  printSection("Runtime communication after send", sent);

  const afterActivitiesCount = Array.isArray(runtime.getActivities())
    ? runtime.getActivities().length
    : 0;

  printSection("Activities delta", {
    before: beforeActivitiesCount,
    after: afterActivitiesCount,
  });

  if (sendResult?.providerMessageId) {
    const labelIds = await getGmailMessageLabelIds({
      messageId: sendResult.providerMessageId,
    });
    printSection("Gmail labelIds for message", labelIds);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

