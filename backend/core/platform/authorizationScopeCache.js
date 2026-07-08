import { markRequestTiming } from "../../../backend/core/platform/requestTiming.js";

const DEFAULT_TTL_MS = 30_000;

const cache = new Map();

function cacheKey(userId, businessId, requiredPermission) {
  return `${userId}:${businessId}:${requiredPermission ?? ""}`;
}

export function getCachedAuthorizationScope(userId, businessId, requiredPermission) {
  const key = cacheKey(userId, businessId, requiredPermission);
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > DEFAULT_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

export function setCachedAuthorizationScope(userId, businessId, requiredPermission, value) {
  cache.set(cacheKey(userId, businessId, requiredPermission), {
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
