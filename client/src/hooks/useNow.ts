import { useEffect, useState } from 'react';

/**
 * A shared render ticker for countdown displays.
 *
 * The store holds deadlines, never counting numbers, so no game state is written as a
 * countdown ticks. Display refresh rate is a UI choice, decoupled from game logic.
 */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
