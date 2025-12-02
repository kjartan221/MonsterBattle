'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/WalletContext';
import { useEquipment } from '@/contexts/EquipmentContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const { initializeWallet, userWallet } = useAuthContext();
  const { refreshEquipment } = useEquipment();
  const [username, setUsername] = useState('');
  const [identityKey, setIdentityKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Validation for manual login
  const isManualLoginValid = username.trim().length > 0 && identityKey.trim().length >= 32;

  const handleLoginWithWallet = async () => {
    setIsLoading(true);
    const loadingToast = toast.loading('Connecting wallet...');

    try {
      // Initialize wallet using context
      await initializeWallet();

      // Wait a tick for state to update, then get fresh values
      await new Promise(resolve => setTimeout(resolve, 100));

      // Access wallet from context to get public key directly
      if (!userWallet) {
        throw new Error('Wallet not initialized');
      }

      // Use non-derived key for login
      const { publicKey } = await userWallet.getPublicKey({
        identityKey: true,
      });

      if (!publicKey) {
        throw new Error('Failed to get wallet public key');
      }

      const walletUsername = username.trim() || 'Wallet User';

      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: publicKey,
          username: walletUsername,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      toast.success('Login successful!', { id: loadingToast });

      // Refresh equipment after successful login
      await refreshEquipment();

      router.push('/battle');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      toast.error(errorMessage, { id: loadingToast });
      console.error('Wallet login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      toast.error('Please enter a username');
      return;
    }

    if (!identityKey.trim()) {
      toast.error('Please enter your identity key');
      return;
    }

    if (identityKey.trim().length < 32) {
      toast.error('Identity key must be at least 32 characters');
      return;
    }

    setIsLoading(true);
    const loadingToast = toast.loading('Logging in...');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: identityKey,
          username: username,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      toast.success('Login successful!', { id: loadingToast });

      // Refresh equipment after successful login
      await refreshEquipment();

      router.push('/battle');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      toast.error(errorMessage, { id: loadingToast });
      console.error('Manual login error:', err);
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
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-transparent text-white/50">Or login manually</span>
            </div>
          </div>

          {/* Manual Login Form */}
          <form onSubmit={handleManualLogin} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-white text-sm font-medium mb-2">
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label htmlFor="identityKey" className="block text-white text-sm font-medium mb-2">
                Identity Key
              </label>
              <input
                type="text"
                id="identityKey"
                value={identityKey}
                onChange={(e) => setIdentityKey(e.target.value)}
                placeholder="Enter your identity key"
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !isManualLoginValid}
              className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-lg border border-white/20 transition-all duration-200 hover:border-white/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/10 disabled:hover:border-white/20 cursor-pointer"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
