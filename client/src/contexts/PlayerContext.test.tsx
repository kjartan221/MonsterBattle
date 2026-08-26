import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { PlayerProvider, usePlayer } from './PlayerContext';

vi.mock('react-hot-toast', () => {
  const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { default: toast, toast };
});

vi.mock('./WalletContext', () => ({
  useAuthContext: () => ({ hasSession: true }),
}));

const apiFetch = vi.fn();
vi.mock('@/lib/apiFetch', () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }));

function statsResponse(currentHealth = 100) {
  return {
    ok: true,
    json: async () => ({
      success: true,
      playerStats: {
        userId: 'u1', level: 1, experience: 0, coins: 0,
        maxHealth: 100, currentHealth, baseDamage: 1, critChance: 5,
      },
    }),
  };
}

// BattlePage deletes its whole subtree while `loading` is true, so a mid-session refetch
// that re-raises it tears down a live battle. This counts those teardowns.
let subtreeMounts = 0;
function Subtree() {
  const { loading } = usePlayer();
  useEffect(() => { subtreeMounts += 1; }, []);
  return <div data-testid="subtree">{loading ? 'loading' : 'ready'}</div>;
}

// Mirrors BattlePage's gate.
function PageWithLoadingGate() {
  const { loading } = usePlayer();
  if (loading) return <div data-testid="spinner">Loading...</div>;
  return <Subtree />;
}

function Harness() {
  return (
    <PlayerProvider>
      <PageWithLoadingGate />
    </PlayerProvider>
  );
}

beforeEach(() => {
  subtreeMounts = 0;
  apiFetch.mockReset();
  apiFetch.mockResolvedValue(statsResponse());
});
afterEach(() => vi.clearAllMocks());

describe('PlayerContext loading flag', () => {
  test('reports loading during the initial fetch', async () => {
    render(<Harness />);

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('subtree')).toBeInTheDocument());
  });

  test('a mid-session refetch does not tear down the subtree', async () => {
    // handlePlayerDeath awaits fetchPlayerStats() before showing the defeat screen.
    let refetch!: () => Promise<void>;
    function Grabber() {
      const { fetchPlayerStats } = usePlayer();
      refetch = fetchPlayerStats;
      return null;
    }

    render(
      <PlayerProvider>
        <Grabber />
        <PageWithLoadingGate />
      </PlayerProvider>
    );

    await waitFor(() => expect(screen.getByTestId('subtree')).toBeInTheDocument());
    const mountsAfterInitialLoad = subtreeMounts;

    // Held open: awaiting the whole call in one act() batches both setLoading calls into
    // a single commit and hides the render under test.
    let release!: () => void;
    apiFetch.mockImplementationOnce(() => new Promise(resolve => {
      release = () => resolve(statsResponse(42));
    }));

    let inFlight!: Promise<void>;
    await act(async () => { inFlight = refetch(); });

    // Mid-flight: the subtree must still be on screen.
    expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    expect(screen.getByTestId('subtree')).toBeInTheDocument();
    expect(subtreeMounts).toBe(mountsAfterInitialLoad);

    await act(async () => { release(); await inFlight; });

    expect(subtreeMounts).toBe(mountsAfterInitialLoad);
  });

  test('a failed refetch also leaves the subtree mounted', async () => {
    let refetch!: () => Promise<void>;
    function Grabber() {
      const { fetchPlayerStats } = usePlayer();
      refetch = fetchPlayerStats;
      return null;
    }

    render(
      <PlayerProvider>
        <Grabber />
        <PageWithLoadingGate />
      </PlayerProvider>
    );
    await waitFor(() => expect(screen.getByTestId('subtree')).toBeInTheDocument());
    const mountsAfterInitialLoad = subtreeMounts;

    apiFetch.mockRejectedValueOnce(new Error('network down'));
    await act(async () => { await refetch(); });

    expect(subtreeMounts).toBe(mountsAfterInitialLoad);
  });

  test('toasts once on the >0 -> 0 transition, and not again while at zero', async () => {
    // Guards the behaviour across the move out of takeDamage's updater. Does not prove the
    // render-phase warning is gone.
    const toastModule = await import('react-hot-toast');
    const toastError = (toastModule.default as unknown as { error: ReturnType<typeof vi.fn> }).error;

    let hit!: (n: number) => Promise<void>;
    function Grabber() {
      const { takeDamage } = usePlayer();
      hit = takeDamage;
      return null;
    }

    render(
      <PlayerProvider>
        <Grabber />
        <PageWithLoadingGate />
      </PlayerProvider>
    );
    await waitFor(() => expect(screen.getByTestId('subtree')).toBeInTheDocument());
    toastError.mockClear();

    await act(async () => { await hit(40); });          // 100 -> 60, no toast
    expect(toastError).not.toHaveBeenCalled();

    await act(async () => { await hit(999); });         // 60 -> 0, one toast
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith('You have been defeated!', { id: 'player-defeated' });

    await act(async () => { await hit(10); });          // already 0, no second toast
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  test('does not toast when the player loads already at zero HP', async () => {
    const toastModule = await import('react-hot-toast');
    const toastError = (toastModule.default as unknown as { error: ReturnType<typeof vi.fn> }).error;

    apiFetch.mockResolvedValue(statsResponse(0));
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId('subtree')).toBeInTheDocument());

    expect(toastError).not.toHaveBeenCalledWith('You have been defeated!', { id: 'player-defeated' });
  });
});
