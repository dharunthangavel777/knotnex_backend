// ─── Redis No-Op Stub ────────────────────────────────────────────────────────
// Redis / Memorystore has been removed from this architecture.
// All code that previously used Redis already has graceful in-memory fallbacks
// gated on isRedisReady(). By always returning false, those fallbacks activate
// automatically with zero code changes in callers.
//
// To re-enable Redis in future: replace this file with the real ioredis client
// and point REDIS_URL to a Memorystore or self-hosted Redis instance.
// ─────────────────────────────────────────────────────────────────────────────

export const redis = {} as any;

// Always false → all callers fall through to their in-memory fallback paths.
export const isRedisReady = (): boolean => false;
