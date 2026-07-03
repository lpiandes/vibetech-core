import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { validateSubscriberShape } from "../../events/subscribers/PlatformEventSubscriberValidator.js";

function fail(message) {
  throw new Error(`AnalyticsSubscriberRegistry: ${message}`);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export class AnalyticsSubscriberRegistry {
  constructor({ subscribers } = {}) {
    const list = safeArray(subscribers);
    const byId = new Map();
    for (const s of list) {
      validateSubscriberShape(s);
      const id = String(s.id);
      if (byId.has(id)) fail(`duplicate subscriber id: ${id}`);
      byId.set(id, deepFreeze(s));
    }

    this._state = deepFreeze({
      subscribers: Array.from(byId.values()),
      byId: deepFreeze(Object.fromEntries(Array.from(byId.entries()))),
    });
  }

  register(subscriber) {
    validateSubscriberShape(subscriber);
    const id = String(subscriber.id);
    if (this._state.byId[id]) fail(`subscriber already registered: ${id}`);

    const nextSubscribers = [...this._state.subscribers, deepFreeze(subscriber)];
    const byId = { ...this._state.byId, [id]: deepFreeze(subscriber) };

    this._state = deepFreeze({
      subscribers: nextSubscribers,
      byId: deepFreeze(byId),
    });
    return this._state.subscribers;
  }

  unregister(subscriberId) {
    const id = String(subscriberId);
    const prev = this._state.subscribers.filter((s) => String(s.id) !== id);
    const byId = Object.fromEntries(prev.map((s) => [String(s.id), s]));
    this._state = deepFreeze({
      subscribers: prev,
      byId: deepFreeze(byId),
    });
    return this._state.subscribers;
  }

  getSubscribers() {
    return this._state.subscribers;
  }

  getSubscriber(subscriberId) {
    const id = String(subscriberId);
    return this._state.byId[id] ?? null;
  }

  getSubscribersForEvent(eventType) {
    const et = String(eventType);
    return this._state.subscribers.filter((s) => safeArray(s.supportedEvents).includes(et));
  }
}

