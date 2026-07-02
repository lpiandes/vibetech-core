import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { validateSubscriberShape } from "./PlatformEventSubscriberValidator.js";

function fail(message) {
  throw new Error(`PlatformEventSubscriberRegistry: ${message}`);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export class PlatformEventSubscriberRegistry {
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
    const prevById = this._state.byId;
    if (prevById[id]) fail(`subscriber already registered: ${id}`);

    const nextSubscribers = [...this._state.subscribers, deepFreeze(subscriber)];
    const byId = { ...prevById, [id]: deepFreeze(subscriber) };

    this._state = deepFreeze({
      subscribers: nextSubscribers,
      byId: deepFreeze(byId),
    });

    return this._state.subscribers;
  }

  unregister(subscriberId) {
    const id = String(subscriberId);
    const prev = this._state.subscribers.filter((s) => String(s.id) !== id);
    this._state = deepFreeze({
      subscribers: prev,
      byId: deepFreeze(Object.fromEntries(prev.map((s) => [String(s.id), s]))),
    });
    return this._state.subscribers;
  }

  getSubscribers() {
    return this._state.subscribers;
  }

  getSubscribersByEvent(eventType) {
    const et = String(eventType);
    return this._state.subscribers.filter((s) => safeArray(s.supportedEvents).includes(et));
  }

  getEnabledSubscribersByEvent(eventType) {
    const et = String(eventType);
    return this._state.subscribers.filter((s) => safeArray(s.supportedEvents).includes(et) && Boolean(s.enabled));
  }
}

