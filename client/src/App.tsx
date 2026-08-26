import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthContextProvider } from '@/contexts/WalletContext';
import { PlayerProvider } from '@/contexts/PlayerContext';
import { BiomeProvider } from '@/contexts/BiomeContext';
import { EquipmentProvider } from '@/contexts/EquipmentContext';
import { ChallengeProvider } from '@/contexts/ChallengeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { startBattleSchedulerLifetime } from '@/stores/battleScheduler';
import BattleSessionGuard from '@/components/BattleSessionGuard';
import ProtectedRoute from '@/components/ProtectedRoute';
import NotFound from '@/components/NotFound';
import LoginPage from '@/components/LoginPage';
import BattlePage from '@/components/BattlePage';
import BlacksmithPage from '@/components/blacksmith/BlacksmithPage';
import CraftingPage from '@/components/crafting/CraftingPage';
import InventoryPage from '@/components/inventory/InventoryPage';
import MarketplacePage from '@/components/marketplace/MarketplacePage';

// Root layout: provider nesting (outer -> inner) + Toaster config.
export default function App() {
  // Bind the scheduler's registrations to the attempt's lifetime. Mounted here, at the top
  // level, because it must outlive any single battle screen: subscribing inside
  // MonsterBattleSection would tear the binding down on the very unmount it guards against,
  // and subscribing at module scope would make it impossible to tear down at all.
  useEffect(() => startBattleSchedulerLifetime(), []);

  return (
    <ErrorBoundary>
      <AuthContextProvider>
        <PlayerProvider>
          <BiomeProvider>
            <EquipmentProvider>
              <ChallengeProvider>
                <BattleSessionGuard />
                <Routes>
                  <Route path="/" element={<LoginPage />} />
                  <Route path="/battle" element={<ProtectedRoute><BattlePage /></ProtectedRoute>} />
                  <Route path="/blacksmith" element={<ProtectedRoute><BlacksmithPage /></ProtectedRoute>} />
                  <Route path="/crafting" element={<ProtectedRoute><CraftingPage /></ProtectedRoute>} />
                  <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
                  <Route path="/marketplace" element={<ProtectedRoute><MarketplacePage /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <Toaster
                  position="top-center"
                  toastOptions={{
                    duration: 4000,
                    style: {
                      background: '#1f2937',
                      color: '#fff',
                      borderRadius: '0.5rem',
                      padding: '1rem',
                    },
                    success: {
                      iconTheme: {
                        primary: '#10b981',
                        secondary: '#fff',
                      },
                    },
                    error: {
                      iconTheme: {
                        primary: '#ef4444',
                        secondary: '#fff',
                      },
                    },
                  }}
                />
              </ChallengeProvider>
            </EquipmentProvider>
          </BiomeProvider>
        </PlayerProvider>
      </AuthContextProvider>
    </ErrorBoundary>
  );
}
