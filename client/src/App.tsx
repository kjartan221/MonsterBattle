import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthContextProvider } from '@/contexts/WalletContext';
import { PlayerProvider } from '@/contexts/PlayerContext';
import { BiomeProvider } from '@/contexts/BiomeContext';
import { EquipmentProvider } from '@/contexts/EquipmentContext';
import { GameStateProvider } from '@/contexts/GameStateContext';
import { ChallengeProvider } from '@/contexts/ChallengeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import RouteGuard from '@/components/RouteGuard';
import NotFound from '@/components/NotFound';
import LoginPage from '@/components/LoginPage';
import BattlePage from '@/components/BattlePage';
import BlacksmithPage from '@/components/blacksmith/BlacksmithPage';
import CraftingPage from '@/components/crafting/CraftingPage';
import InventoryPage from '@/components/inventory/InventoryPage';
import MarketplacePage from '@/components/marketplace/MarketplacePage';

// Ports src/app/layout.tsx: same provider nesting (outer -> inner) and Toaster config.
export default function App() {
  return (
    <ErrorBoundary>
      <AuthContextProvider>
        <PlayerProvider>
          <BiomeProvider>
            <EquipmentProvider>
              <ChallengeProvider>
                <GameStateProvider>
                  <RouteGuard>
                    <Routes>
                      <Route path="/" element={<LoginPage />} />
                      <Route path="/battle" element={<BattlePage />} />
                      <Route path="/blacksmith" element={<BlacksmithPage />} />
                      <Route path="/crafting" element={<CraftingPage />} />
                      <Route path="/inventory" element={<InventoryPage />} />
                      <Route path="/marketplace" element={<MarketplacePage />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </RouteGuard>
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
                </GameStateProvider>
              </ChallengeProvider>
            </EquipmentProvider>
          </BiomeProvider>
        </PlayerProvider>
      </AuthContextProvider>
    </ErrorBoundary>
  );
}
