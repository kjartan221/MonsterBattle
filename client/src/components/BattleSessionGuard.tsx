import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useBattleStore } from '@/stores/battleStore';

const BATTLE_PATH = '/battle';

/**
 * Ends the battle attempt when the player navigates away from the battle route.
 *
 * Deadlines are absolute, so away-time would otherwise count against the player. Lives above
 * the route so it survives the navigation it watches — keying this off MonsterBattleSection's
 * unmount conflated "left the page" with "React remounted the component".
 */
export default function BattleSessionGuard() {
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);

  useEffect(() => {
    const left = previousPath.current === BATTLE_PATH && pathname !== BATTLE_PATH;
    previousPath.current = pathname;
    if (!left) return;

    // lootSelection and victory are preserved: the server has already rolled that loot and
    // start-battle's restore path recovers it.
    const { state, reset } = useBattleStore.getState();
    if (state.phase === 'inProgress' || state.phase === 'completing') {
      reset();
    }
  }, [pathname]);

  return null;
}
