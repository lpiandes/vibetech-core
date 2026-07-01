 "use client";

import { motion } from "framer-motion";

import QueueHeader from "./QueueHeader";
import QueueFilters from "./QueueFilters";
import QueueItem, { type QueueItemModel } from "./QueueItem";
import EmptyState from "./EmptyState";

export default function WorkQueue({
  items,
}: {
  items: QueueItemModel[];
}) {
  const queueItems = items;

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

