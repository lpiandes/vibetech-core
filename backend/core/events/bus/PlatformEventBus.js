import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { isValidPlatformEventType } from "../PlatformEventType.js";

import { validatePlatformEventCanonical } from "./PlatformEventBusValidator.js";

import { createPlatformEventSubscriber } from "./PlatformEventSubscriber.js";
import { createPlatformEventSubscription } from "./PlatformEventSubscription.js";

import { createPlatformEventDispatchResult } from "./PlatformEventDispatchResult.js";
import { createPlatformEventDispatchReport } from "./PlatformEventDispatchReport.js";

import { DISPATCH_RESULT_STATUSES } from "./PlatformEventBusDefaults.js";

function fail(message) {
  throw new Error(`PlatformEventBus: ${message}`);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function toSortedSubscribers(subscribers) {
  const copy = [...subscribers];
  copy.sort((a, b) => {
    const pa = Number(a.priority ?? 0);
    const pb = Number(b.priority ?? 0);
    if (pa !== pb) return pa - pb;
    return String(a.id).localeCompare(String(b.id));
  });
  return copy;
}

function buildSubscribersByEventType(subscriptions) {
  const byEventType = {};
  for (const s of subscriptions) {
    const et = String(s.eventType);
    const sub = s.subscriber;
    (byEventType[et] ??= []).push(sub);
  }

  for (const et of Object.keys(byEventType)) {
    byEventType[et] = toSortedSubscribers(byEventType[et]);
  }

  return deepFreeze(byEventType);
}

export class PlatformEventBus {
  constructor({ nowISO } = {}) {
    this.nowISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");
    this._state = deepFreeze({
      subscriptions: [],
      subscribersByEventType: deepFreeze({}),
    });
  }

  getSubscriptions() {
    return this._state.subscriptions;
  }

  getSubscribersForEvent(eventType) {
    const et = String(eventType);
    return this._state.subscribersByEventType[et] ?? [];
  }

  subscribe({ eventType, subscriber } = {}) {
    if (!isValidPlatformEventType(eventType)) fail(`subscribe: invalid eventType: ${String(eventType)}`);
    if (!subscriber || typeof subscriber !== "object") fail("subscribe: subscriber required.");

    const subscriberBuilt = createPlatformEventSubscriber(subscriber);

    const supported = safeArray(subscriberBuilt.supportedEvents).map((x) => String(x));
    if (!supported.includes(String(eventType))) {
      fail(`subscribe: subscriber does not support eventType: ${String(eventType)}`);
    }

    const subId = String(subscriberBuilt.id);
    const existing = this._state.subscriptions.find((s) => String(s.eventType) === String(eventType) && String(s.subscriber.id) === subId);
    if (existing) fail(`subscribe: duplicate subscriber id for eventType: ${subId}`);

    const nextSubscription = createPlatformEventSubscription({ eventType, subscriber: subscriberBuilt });
    const nextSubscriptions = [...this._state.subscriptions, nextSubscription];
    const nextSubscribersByEventType = buildSubscribersByEventType(nextSubscriptions);

    this._state = deepFreeze({
      subscriptions: nextSubscriptions,
      subscribersByEventType: nextSubscribersByEventType,
    });

    return nextSubscription;
  }

  unsubscribe({ eventType, subscriber } = {}) {
    if (!isValidPlatformEventType(eventType)) fail(`unsubscribe: invalid eventType: ${String(eventType)}`);
    if (!subscriber || typeof subscriber !== "object") fail("unsubscribe: subscriber required.");
    const subscriberId = String(subscriber.id ?? "");
    if (!subscriberId) fail("unsubscribe: subscriber.id required.");

    const nextSubscriptions = this._state.subscriptions.filter(
      (s) => !(String(s.eventType) === String(eventType) && String(s.subscriber.id) === subscriberId),
    );
    const nextSubscribersByEventType = buildSubscribersByEventType(nextSubscriptions);

    this._state = deepFreeze({
      subscriptions: nextSubscriptions,
      subscribersByEventType: nextSubscribersByEventType,
    });

    return this._state.subscriptions;
  }

  dispatch(event, { dispatchedAtISO } = {}) {
    validatePlatformEventCanonical(event);
    const et = String(event.eventType);

    const subscribers = this.getSubscribersForEvent(et);
    const effectiveDispatchedAtISO = String(dispatchedAtISO ?? this.nowISO);

    const results = [];
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;

    for (const sub of subscribers) {
      const subscriberId = String(sub.id);
      const subscriberName = String(sub.name);
      try {
        const handleResult = sub.handle(event);

        if (!handleResult || typeof handleResult !== "object") {
          const res = createPlatformEventDispatchResult({
            subscriberId,
            subscriberName,
            status: DISPATCH_RESULT_STATUSES.SKIPPED,
            message: "Skipped: subscriber returned no result.",
            metadata: {},
          });
          results.push(res);
          skippedCount += 1;
          continue;
        }

        const status = String(handleResult.status ?? "");
        if (!Object.values(DISPATCH_RESULT_STATUSES).includes(status)) {
          throw new Error(`invalid dispatch result status: ${status}`);
        }

        const res = createPlatformEventDispatchResult({
          subscriberId,
          subscriberName,
          status,
          message: handleResult.message === undefined ? "" : String(handleResult.message),
          metadata: handleResult.metadata,
        });

        results.push(res);
        if (status === DISPATCH_RESULT_STATUSES.SUCCESS) successCount += 1;
        if (status === DISPATCH_RESULT_STATUSES.FAILED) failureCount += 1;
        if (status === DISPATCH_RESULT_STATUSES.SKIPPED) skippedCount += 1;
      } catch (err) {
        const res = createPlatformEventDispatchResult({
          subscriberId,
          subscriberName,
          status: DISPATCH_RESULT_STATUSES.FAILED,
          message: String(err?.message ?? err),
          metadata: {},
        });
        results.push(res);
        failureCount += 1;
      }
    }

    const report = createPlatformEventDispatchReport({
      eventId: String(event.eventId),
      eventType: et,
      dispatchedAt: effectiveDispatchedAtISO,
      results,
      successCount,
      failureCount,
      skippedCount,
      metadata: deepFreeze({ derivedFrom: { eventType: et } }),
    });

    return report;
  }
}

