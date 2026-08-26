/**
 * Server payloads use seconds; client timed effects use milliseconds. Route conversions
 * through here - both sides are `number`, so a dropped x1000 typechecks cleanly and only
 * surfaces as a buff that expires instantly.
 */
export function buffDurationMs(durationSeconds: number): number {
  return durationSeconds * 1000;
}
