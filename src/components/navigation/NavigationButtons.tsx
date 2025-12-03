'use client';

import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface NavigationButtonsProps {
  showMarketplace?: boolean;
  showInventory?: boolean;
  showBlacksmith?: boolean;
  showCrafting?: boolean;
  showBattle?: boolean;
  showLogout?: boolean;
}

export default function NavigationButtons({
  showMarketplace = false,
  showInventory = false,
  showBlacksmith = false,
  showCrafting = false,
  showBattle = false,
  showLogout = false,
}: NavigationButtonsProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      toast.success('Logged out successfully');
      router.push('/');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Failed to logout');
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {showMarketplace && (
        <button
          onClick={() => router.push('/marketplace')}
          className="px-4 py-2 bg-gradient-to-br from-blue-900/80 to-purple-900/80 backdrop-blur-lg border border-white/20 hover:border-white/40 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-purple-500/50 cursor-pointer text-sm md:text-base"
        >
          🏪 <span className="hidden sm:inline">Marketplace</span>
        </button>
      )}

      {showInventory && (
        <button
          onClick={() => router.push('/inventory')}
          className="px-4 py-2 bg-gradient-to-br from-blue-900/80 to-purple-900/80 backdrop-blur-lg border border-white/20 hover:border-white/40 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-purple-500/50 cursor-pointer text-sm md:text-base"
        >
          📦 <span className="hidden sm:inline">Inventory</span>
        </button>
      )}

      {showBlacksmith && (
        <button
          onClick={() => router.push('/blacksmith')}
          className="px-4 py-2 bg-gradient-to-br from-blue-900/80 to-purple-900/80 backdrop-blur-lg border border-white/20 hover:border-white/40 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-purple-500/50 cursor-pointer text-sm md:text-base"
        >
          🔨 <span className="hidden sm:inline">Blacksmith</span>
        </button>
      )}

      {showCrafting && (
        <button
          onClick={() => router.push('/crafting')}
          className="px-4 py-2 bg-gradient-to-br from-blue-900/80 to-purple-900/80 backdrop-blur-lg border border-white/20 hover:border-white/40 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-purple-500/50 cursor-pointer text-sm md:text-base"
        >
          ⚒️ <span className="hidden sm:inline">Crafting</span>
        </button>
      )}

      {showBattle && (
        <button
          onClick={() => router.push('/battle')}
          className="px-4 py-2 bg-gradient-to-br from-blue-900/80 to-purple-900/80 backdrop-blur-lg border border-white/20 hover:border-white/40 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-purple-500/50 cursor-pointer text-sm md:text-base"
        >
          ⚔️ <span className="hidden sm:inline">Battle</span>
        </button>
      )}

      {showLogout && (
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-gradient-to-br from-red-900/80 to-purple-900/80 backdrop-blur-lg border border-white/20 hover:border-white/40 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-purple-500/50 cursor-pointer text-sm md:text-base"
        >
          🚪 <span className="hidden sm:inline">Logout</span>
        </button>
      )}
    </div>
  );
}
