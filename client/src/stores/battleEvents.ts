import type { DebuffEffect } from '@shared/types';

/**
 * The one seam between scheduler handlers and React: they describe what happened, and
 * `useBattleEffects` applies it to PlayerContext. Synchronous - ordering against store
 * writes matters.
 */
export interface BattleEventMap {
  monsterAttacked: {
    damage: number;          // post-mitigation damage to the player
    thornsDamage: number;    // reflected to the monster; 0 if none
    lifestealHeal: number;   // defensive lifesteal; 0 if none
    dotEffect?: DebuffEffect;
  };
  dotTicked: { damage: number };
}

type Handler<K extends keyof BattleEventMap> = (payload: BattleEventMap[K]) => void;

const listeners: { [K in keyof BattleEventMap]: Set<Handler<K>> } = {
  monsterAttacked: new Set(),
  dotTicked: new Set(),
};

export const battleEvents = {
  on<K extends keyof BattleEventMap>(event: K, handler: Handler<K>): () => void {
    listeners[event].add(handler as never);
    return () => { listeners[event].delete(handler as never); };
  },
  emit<K extends keyof BattleEventMap>(event: K, payload: BattleEventMap[K]): void {
    // Copy first: a handler may unsubscribe itself mid-dispatch.
    for (const handler of [...listeners[event]] as Handler<K>[]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[battleEvents] ${event} handler threw:`, err);
      }
    }
  },
};
