'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/WalletContext';
import toast from 'react-hot-toast';
import { authClient } from '@shared/authProof';

export default function LoginPage() {
  const router = useRouter();
  const { initializeWallet, userWallet, refreshSession } = useAuthContext();
  const [username, setUsername] = useState('');
  const [identityKey, setIdentityKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Validation for manual login
  const isManualLoginValid = username.trim().length > 0 && identityKey.trim().length >= 32;

  const handleLoginWithWallet = async () => {
    setIsLoading(true);
    const loadingToast = toast.loading('Connecting wallet...');

    try {
      // Initialize wallet using context; use the returned instance directly
      // (context state updates aren't visible in this closure until next render)
      const wallet = await initializeWallet() ?? userWallet;
      if (!wallet) {
        throw new Error('Wallet not initialized');
      }

      // Use non-derived key for login
      const { publicKey } = await wallet.getPublicKey({
        identityKey: true,
      });

      if (!publicKey) {
        throw new Error('Failed to get wallet public key');
      }

      const walletUsername = username.trim() || 'Wallet User';

      // Fetch server identity key, then build a signed, expiry-bound, single-use proof
      const serverKeyRes = await fetch('/api/server-identity-key');
      const { publicKey: serverIdentityKey } = await serverKeyRes.json();
      const proof = await authClient.createAuthProof(wallet, serverIdentityKey, 'login');

      toast.loading('Logging in...', { id: loadingToast });

      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: publicKey,
          username: walletUsername,
          proof,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Flip hasSession true; PlayerContext/EquipmentContext/ChallengeContext react by fetching
      toast.loading('Loading player data...', { id: loadingToast });
      await refreshSession();

      toast.success('Login successful!', { id: loadingToast });

      // Navigate to battle page
      router.push('/battle');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      toast.error(errorMessage, { id: loadingToast });
      console.error('Wallet login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 dark:from-purple-950 dark:via-blue-950 dark:to-indigo-950">
      <div className="w-full max-w-md px-8">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
          <h1 className="text-4xl font-bold text-white text-center mb-2">
            Monster Battle
          </h1>
          <p className="text-white/70 text-center mb-8">Login to start battling</p>

          {/* Login with Wallet Button */}
          <button
            onClick={handleLoginWithWallet}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg mb-6 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 cursor-pointer"
          >
            {isLoading ? 'Logging in...' : 'Login with Wallet'}
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/20"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
