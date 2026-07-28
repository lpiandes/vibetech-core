import { notFound } from "next/navigation";

import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import PeopleDetailRenderer from "@/components/people/PeopleDetailRenderer";
import CrmContactDetail from "@/components/people/CrmContactDetail";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";
import { platformStore } from "@/lib/server/compose";
import { readCrmState } from "../../../../../backend/core/crm/CrmStore.js";
import { findContact } from "../../../../../backend/core/crm/ensureCrmContactAndOptionalCard.js";
import { PERMISSIONS } from "@/lib/platform/permissions";

export default async function PeopleDetailPage({
  params,
}: {
  params: Promise<{ businessId: string; partyId: string }>;
}) {
  const { businessId, partyId } = await params;

  return runTimedPage("people-detail", async () => {
    await getAuthorizedWorkspace(businessId, PERMISSIONS.PEOPLE_VIEW);

    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    const crm = readCrmState(installation);
    const contact = findContact(crm, { id: partyId, partyId });

    if (contact) {
      const cards = [];
      for (const pipe of crm.pipelines ?? []) {
        for (const card of pipe.cards ?? []) {
          if (String(card.contactId) === String(contact.id) || String(card.partyId) === String(contact.id)) {
            const stage = (pipe.stages ?? []).find((s: { id: string }) => s.id === card.stageId);
            cards.push({
              id: card.id,
              title: card.title,
              stageId: card.stageId,
              stageLabel: stage?.label,
              pipelineId: pipe.id,
              pipelineName: pipe.name,
              value: card.value,
            });
          }
        }
      }
      markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(contact).length, source: "crm" });
      return (
        <CrmContactDetail
          businessId={businessId}
          model={{ contact, cards }}
        />
      );
    }

    const { service } = await getAuthorizedWorkspace(businessId);
    let viewModel;
    try {
      viewModel = service.loadEngagementViewModel(partyId);
    } catch {
      notFound();
    }

    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(viewModel).length, source: "graph" });
    return <PeopleDetailRenderer businessId={businessId} viewModel={viewModel} />;
  });
}
