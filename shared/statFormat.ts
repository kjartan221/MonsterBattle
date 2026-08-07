// Display-only rounding for stat values (does not affect gameplay math).
export function formatStatValue(n: number): number {
  return Number(n.toFixed(2));
}
