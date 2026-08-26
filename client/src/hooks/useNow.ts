import { useEffect, useState } from 'react';

/** Render ticker for countdowns. The store holds deadlines, never counting numbers. */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
