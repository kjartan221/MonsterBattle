"use client"

import {
    WalletClient,
} from '@bsv/sdk'
import { useContext, createContext, useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";

type authContextType = {
    userWallet: WalletClient | null;
    userPubKey: string | null; // DEPRECATED: Use userDerivedKey for blockchain ops
    userIdentityKey: string | null; // Non-derived key for user ID/database
    userDerivedKey: string | null; // Derived key for blockchain/token operations
    initializeWallet: () => Promise<void>;
    setIsAuthenticated: (value: boolean) => void;
    isAuthenticated: boolean | null;
    checkAuth: () => Promise<boolean>;
}

const AuthContext = createContext<authContextType>({
    userWallet: null,
    userPubKey: null,
    userIdentityKey: null,
    userDerivedKey: null,
    initializeWallet: async () => { },
    setIsAuthenticated: () => { },
    isAuthenticated: null,
    checkAuth: async () => { return false; },
});
export const AuthContextProvider = ({ children }: { children: React.ReactNode }) => {
    const [userWallet, setUserWallet] = useState<authContextType['userWallet']>(null);
    const [userPubKey, setUserPubKey] = useState<authContextType['userPubKey']>(null); // DEPRECATED
    const [userIdentityKey, setUserIdentityKey] = useState<string | null>(null); // Non-derived
    const [userDerivedKey, setUserDerivedKey] = useState<string | null>(null); // Derived
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    const checkAuth = useCallback(async (): Promise<boolean> => {
        try {
            if (userWallet) {
                const authenticated = await userWallet.isAuthenticated();
                const isAuth = !!authenticated;
                setIsAuthenticated(isAuth);
                return isAuth;
            } else {
                // No wallet means not authenticated (during initial load)
                setIsAuthenticated(false);
                return false;
            }
        } catch (error) {
            console.error("Failed to check authentication:", error);
            setIsAuthenticated(false);
            return false;
        }
    }, [userWallet]);

    const initializeWallet = useCallback(async () => {
        try {
            const newWallet = new WalletClient('auto', 'fractionalize');

            const isConnected = await newWallet.isAuthenticated();
            if (!isConnected) {
                console.error('Wallet not authenticated');
                toast.error('Wallet not authenticated', {
                    duration: 5000,
                    position: 'top-center',
                    id: 'wallet-not-authenticated',
                });
                setIsAuthenticated(false);
                return;
            }

            // Get identity key (non-derived) for database operations and user ID
            const { publicKey: identityKey } = await newWallet.getPublicKey({
                identityKey: true,
            });

            // Get derived key for blockchain operations (tokens, transactions)
            const { publicKey: derivedKey } = await newWallet.getPublicKey({
                protocolID: [0, "monsterbattle"],
                keyID: "0",
            });

            // Only update state once everything is fetched
            setUserWallet(newWallet);
            setUserIdentityKey(identityKey);
            setUserDerivedKey(derivedKey);
            setUserPubKey(derivedKey); // Keep for backward compatibility (DEPRECATED)

            // Check authentication after wallet is initialized
            const authenticated = await newWallet.isAuthenticated();
            setIsAuthenticated(!!authenticated);

            toast.success('Wallet connected successfully', {
                duration: 5000,
                position: 'top-center',
                id: 'wallet-connect-success',
            });
        } catch (error) {
            console.error('Failed to initialize wallet:', error);
            toast.error('Failed to connect wallet', {
                duration: 5000,
                position: 'top-center',
                id: 'wallet-connect-error',
            });
            setIsAuthenticated(false);
        }
    }, []);

    useEffect(() => {
        initializeWallet();
    }, [initializeWallet]);

    // Check auth when wallet changes (to handle reconnections)
    useEffect(() => {
        if (userWallet) {
            checkAuth();
        }
    }, [userWallet, checkAuth]);

    return (
        <AuthContext.Provider value={{ userWallet, userPubKey, userIdentityKey, userDerivedKey, initializeWallet, isAuthenticated, setIsAuthenticated, checkAuth }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuthContext = () => useContext(AuthContext);