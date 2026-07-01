 "use client";

import { motion } from "framer-motion";

import QueueHeader from "./QueueHeader";
import QueueFilters from "./QueueFilters";
import QueueItem, { type QueueItemModel } from "./QueueItem";
import EmptyState from "./EmptyState";
import { demoCompany } from "@/lib/company/demoCompany";

export default function WorkQueue() {
  const buyerById = new Map(
    demoCompany.companyData.buyers.map((b) => [b.buyerId, b.name]),
  );
  const propertyById = new Map(
    demoCompany.companyData.properties.map((p) => [p.propertyId, p]),
  );

  const queueItems: QueueItemModel[] = demoCompany.companyData.inquiries
    .filter((i) => i.queueVisible)
    .map((i) => {
      const buyerName = buyerById.get(i.buyerId) ?? "Buyer";
      const p = propertyById.get(i.propertyId);
      const propertySummary = p
        ? `${p.address} (${p.city}, ${p.state})`
        : "Property";

      return {
        id: i.inquiryId,
        title: "Draft response",
        clientName: buyerName,
        matterType: propertySummary,
        priority: i.priority,
        status: i.status,
        employee: i.employeeName,
        createdTimeISO: i.createdTimeISO,
      };
    });

  return (
    <div className="space-y-8">
      <QueueHeader />

      <QueueFilters />

      <div className="space-y-5">
        {queueItems.length === 0 ? (
          <EmptyState />
        ) : (
          queueItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02, duration: 0.25 }}
            >
              <QueueItem item={item} />
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

