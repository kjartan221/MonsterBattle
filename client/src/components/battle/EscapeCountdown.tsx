import { useNow } from '@/hooks/useNow';

/**
 * Fast-buff countdown, derived from the stored deadline. Owns its ticker so the 4Hz
 * re-render is scoped here and only exists while a Fast monster does.
 *
 * The `- 1` pairs with escapeDeadlineFrom's `+ 1`: renders V first, counts to 1, then hides
 * for the final silent second - matching the pre-refactor display frame-for-frame.
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
