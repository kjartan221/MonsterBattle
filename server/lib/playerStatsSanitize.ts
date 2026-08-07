export const PLAYER_STATS_MAX_HEALTH_CEILING = 100000;

/**
 * PATCH /api/player-stats accepts ONLY currentHealth (ephemeral, re-validated by
 * anti-cheat). Everything else is server-authoritative and must never be client-set.
 */
export function sanitizePlayerStatsUpdate(body: unknown): { currentHealth: number } | null {
  if (!body || typeof body !== 'object') return null;
  const updates = (body as { updates?: unknown }).updates;
  if (!updates || typeof updates !== 'object') return null;
  const raw = (updates as { currentHealth?: unknown }).currentHealth;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  const currentHealth = Math.max(0, Math.min(PLAYER_STATS_MAX_HEALTH_CEILING, Math.floor(raw)));
  return { currentHealth };
}
