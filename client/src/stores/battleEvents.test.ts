import { describe, test, expect, vi, afterEach } from 'vitest';
import { battleEvents } from './battleEvents';

const swing = { damage: 7, thornsDamage: 0, lifestealHeal: 0 };

const cleanups: Array<() => void> = [];
function on(...args: Parameters<typeof battleEvents.on>) {
  const off = battleEvents.on(...args);
  cleanups.push(off);
  return off;
}
afterEach(() => {
  cleanups.splice(0).forEach(off => off());
  vi.restoreAllMocks();
});

describe('battleEvents', () => {
  test('a subscriber receives the emitted payload', () => {
    const handler = vi.fn();
    on('monsterAttacked', handler);

    battleEvents.emit('monsterAttacked', swing);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(swing);
  });

  test('unsubscribing stops delivery', () => {
    const handler = vi.fn();
    const off = on('dotTicked', handler);

    battleEvents.emit('dotTicked', { damage: 3 });
    off();
    battleEvents.emit('dotTicked', { damage: 3 });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('a throwing subscriber does not stop the others', () => {
    // One bad bridge must not cost the player their damage tick.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const thrower = vi.fn(() => { throw new Error('boom'); });
    const after = vi.fn();
    on('monsterAttacked', thrower);
    on('monsterAttacked', after);

    expect(() => battleEvents.emit('monsterAttacked', swing)).not.toThrow();

    expect(thrower).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
  });
});
