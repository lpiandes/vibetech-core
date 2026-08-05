import { markRequestTiming } from "../../../backend/core/platform/requestTiming.js";

const DEFAULT_TTL_MS = 5 * 60_000;

/** Base membership/permissions keyed by user+business — permission checks happen in memory. */
const cache = new Map();

function cacheKey(userId, businessId) {
  return `${userId}:${businessId}`;
}

export function getCachedAuthorizationScope(userId, businessId, _requiredPermission) {
  const key = cacheKey(userId, businessId);
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > DEFAULT_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

export function setCachedAuthorizationScope(userId, businessId, _requiredPermission, value) {
  cache.set(cacheKey(userId, businessId), {
    at: Date.now(),
    value,
  });
}

export function clearAuthorizationScopeCacheForTests() {
  cache.clear();
}

export function noteAuthorizationCacheHit() {
  markRequestTiming("AUTHZ_CACHE_HIT");
}
