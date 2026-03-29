/**
 * Zustand store for wallet state management
 * 
 * This is the central state management for our crypto wallet.
 * It handles wallet creation, account management, and blockchain state.
 * 
 * Web3 Learning Note: State management in crypto wallets is crucial because
 * you need to track wallet status, multiple accounts, balances, and transactions
 * across different blockchains in a consistent way.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { 
  Wallet, 
  Account, 
  Balance, 
  Token, 
  Transaction, 
  Chain, 
  ChainConfig,
  WalletError 
} from '@/lib/types/wallet';

// Define the shape of our wallet state
interface WalletState {
  // Core wallet state
  currentWallet: Wallet | null;
  isUnlocked: boolean;
  currentAccount: Account | null;
  
  // Multi-chain state
  activeChain: Chain;
  supportedChains: ChainConfig[];
  
  // Balance and token state
  balances: Record<string, Balance>; // accountId -> Balance
  tokens: Record<string, Token[]>;   // accountId -> Token[]
  
  // Transaction state
  pendingTransactions: Transaction[];
  transactionHistory: Transaction[];
  
  // UI state
  isLoading: boolean;
  error: WalletError | null;
  warning: string | null;
  
  // Actions for state updates
  actions: {
    // Wallet management
    setWallet: (wallet: Wallet) => void;
    lockWallet: () => void;
    unlockWallet: () => void;
    clearWallet: () => void;
    
    // Account management
    setCurrentAccount: (account: Account | null) => void;
    addAccount: (account: Account) => void;
    updateAccount: (accountId: string, updates: Partial<Account>) => void;
    
    // Chain management
    setActiveChain: (chain: Chain) => void;
    setSupportedChains: (chains: ChainConfig[]) => void;
    
    // Balance management
    setBalance: (accountId: string, balance: Balance) => void;
    setTokens: (accountId: string, tokens: Token[]) => void;
    
    // Transaction management
    addPendingTransaction: (transaction: Transaction) => void;
    updateTransaction: (txId: string, updates: Partial<Transaction>) => void;
    addToHistory: (transaction: Transaction) => void;
    
    // UI state management
    setLoading: (loading: boolean) => void;
    setError: (error: WalletError | null) => void;
    setWarning: (warning: string | null) => void;
  };
}

/**
 * Create the wallet store with Zustand
 * 
 * subscribeWithSelector middleware allows us to listen to specific
 * state changes, which is useful for triggering side effects like
 * saving wallet state to localStorage or triggering API calls.
 */
export const useWalletStore = create<WalletState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    currentWallet: null,
    isUnlocked: false,
    currentAccount: null,
    activeChain: 'Ethereum',
    supportedChains: [
      {
        id: 'Ethereum',
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
        rpcUrl: '', // Configured via NEXT_PUBLIC_ETH_RPC_URL env var
        explorerUrl: 'https://etherscan.io',
        isTestnet: false,
      },
      {
        id: 'Solana',
        name: 'Solana',
        symbol: 'SOL',
        decimals: 9,
        rpcUrl: 'https://api.mainnet-beta.solana.com',
        explorerUrl: 'https://explorer.solana.com',
        isTestnet: false,
      },
      {
        id: 'Bitcoin',
        name: 'Bitcoin',
        symbol: 'BTC',
        decimals: 8,
        rpcUrl: '', // Bitcoin doesn't use standard RPC
        explorerUrl: 'https://blockstream.info',
        isTestnet: false,
      },
    ],
    balances: {},
    tokens: {},
    pendingTransactions: [],
    transactionHistory: [],
    isLoading: false,
    error: null,
    warning: null,

    // Actions
    actions: {
      // Wallet management actions
      setWallet: (wallet: Wallet) => 
        set({ currentWallet: wallet }),
      
      lockWallet: () =>
        set({
          isUnlocked: false,
          currentAccount: null,
          error: null,
          warning: null,
        }),
      
      unlockWallet: () => 
        set({ isUnlocked: true, error: null }),
      
      clearWallet: () => 
        set({
          currentWallet: null,
          isUnlocked: false,
          currentAccount: null,
          balances: {},
          tokens: {},
          pendingTransactions: [],
          transactionHistory: [],
          error: null,
          warning: null,
        }),

      // Account management actions
      setCurrentAccount: (account: Account | null) => 
        set({ currentAccount: account }),
      
      addAccount: (account: Account) => 
        set((state) => ({
          currentWallet: state.currentWallet ? {
            ...state.currentWallet,
            accounts: [...state.currentWallet.accounts, account]
          } : null
        })),
      
      updateAccount: (accountId: string, updates: Partial<Account>) => 
        set((state) => ({
          currentWallet: state.currentWallet ? {
            ...state.currentWallet,
            accounts: state.currentWallet.accounts.map(account =>
              account.id === accountId ? { ...account, ...updates } : account
            )
          } : null
        })),

      // Chain management actions
      setActiveChain: (chain: Chain) => 
        set({ activeChain: chain }),
      
      setSupportedChains: (chains: ChainConfig[]) => 
        set({ supportedChains: chains }),

      // Balance management actions
      setBalance: (accountId: string, balance: Balance) => 
        set((state) => ({
          balances: {
            ...state.balances,
            [accountId]: balance
          }
        })),
      
      setTokens: (accountId: string, tokens: Token[]) => 
        set((state) => ({
          tokens: {
            ...state.tokens,
            [accountId]: tokens
          }
        })),

      // Transaction management actions
      addPendingTransaction: (transaction: Transaction) => 
        set((state) => ({
          pendingTransactions: [...state.pendingTransactions, transaction]
        })),
      
      updateTransaction: (txId: string, updates: Partial<Transaction>) => 
        set((state) => ({
          pendingTransactions: state.pendingTransactions.map(tx =>
            tx.id === txId ? { ...tx, ...updates } : tx
          ),
          transactionHistory: state.transactionHistory.map(tx =>
            tx.id === txId ? { ...tx, ...updates } : tx
          )
        })),
      
      addToHistory: (transaction: Transaction) => 
        set((state) => ({
          transactionHistory: [transaction, ...state.transactionHistory],
          pendingTransactions: state.pendingTransactions.filter(
            tx => tx.id !== transaction.id
          )
        })),

      // UI state management actions
      setLoading: (loading: boolean) => 
        set({ isLoading: loading }),
      
      setError: (error: WalletError | null) =>
        set({ error }),

      setWarning: (warning: string | null) =>
        set({ warning }),
    }
  }))
);

/**
 * Convenience hooks for accessing specific parts of the store
 * These make it easier to use the store in components without
 * causing unnecessary re-renders.
 */

// Hook for wallet state
export const useWallet = () => useWalletStore((state) => state.currentWallet);
export const useIsUnlocked = () => useWalletStore((state) => state.isUnlocked);
export const useCurrentAccount = () => useWalletStore((state) => state.currentAccount);

// Hook for chain state  
export const useActiveChain = () => useWalletStore((state) => state.activeChain);
export const useSupportedChains = () => useWalletStore((state) => state.supportedChains);

// Hook for balance state
export const useAccountBalance = (accountId: string) => 
  useWalletStore((state) => state.balances[accountId]);
export const useAccountTokens = (accountId: string) => 
  useWalletStore((state) => state.tokens[accountId] || []);

// Hook for transaction state
export const usePendingTransactions = () => 
  useWalletStore((state) => state.pendingTransactions);
export const useTransactionHistory = () => 
  useWalletStore((state) => state.transactionHistory);

// Hook for UI state
export const useWalletLoading = () => useWalletStore((state) => state.isLoading);
export const useWalletError = () => useWalletStore((state) => state.error);
export const useWalletWarning = () => useWalletStore((state) => state.warning);

// Hook for actions
export const useWalletActions = () => useWalletStore((state) => state.actions);