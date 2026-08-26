import { useNow } from '@/hooks/useNow';

/**
 * Escape countdown for the Fast buff, derived at render time from the stored deadline.
 *
 * Owns its own ticker so the 4Hz re-render is scoped to this handful of nodes and only
 * exists while a Fast monster does — mounting it unconditionally in the parent would
 * re-render the whole battle tree four times a second for every fight.
 *
 * The trailing `- 1` reproduces the old check-then-decrement display: `deadline` is
 * escapeDeadlineFrom's (V+1)s-out deadline, so subtracting 1 here makes the first rendered
 * frame show V (not V+1), counts down to 1, then hits 0 and is hidden by the `> 0` guard for
 * the final second before the deadline actually fires — matching the original frame-for-frame.
 */
export default function EscapeCountdown({ deadline }: { deadline: number }) {
  const now = useNow(250);
  const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000) - 1);
  if (secondsLeft <= 0) return null;

  return (
    <div className="w-full px-6 py-3 bg-yellow-500/20 rounded-lg border-2 border-yellow-400 animate-pulse">
      <div className="flex items-center justify-between">
        <span className="text-yellow-400 font-bold text-lg">⚡ Monster Escaping!</span>
        <span className="text-yellow-200 font-bold text-xl">{secondsLeft}s</span>
      </div>
      <div className="mt-2 text-yellow-200 text-sm text-center">
        Defeat it before it escapes!
      </div>
    </div>
  );
}
