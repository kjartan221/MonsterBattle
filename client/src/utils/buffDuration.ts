/**
 * Server consumable/spell payloads express `duration` in whole SECONDS. Every timed effect in
 * the client is stored in MILLISECONDS (`durationMs`, plus an absolute `expiresAt` deadline the
 * scheduler reads). This is the single crossing point between the two units.
 *
 * It exists as a named function because both sides are `number`: a dropped or duplicated
 * ×1000 typechecks cleanly and only shows up as a buff that expires ~instantly (or outlives
 * the battle). Route every seconds→ms conversion through here so it stays testable.
 */
export function buffDurationMs(durationSeconds: number): number {
  return durationSeconds * 1000;
}
