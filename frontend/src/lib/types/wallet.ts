/**
 * Core wallet types for the crypto wallet frontend
 * 
 * These types define the data structures that our frontend components
 * will use to interact with wallet functionality. They align with the
 * backend implementation we've already built.
 */

// Supported blockchain chains
export type Chain = 'Bitcoin' | 'Ethereum' | 'Solana';

// Wallet account information (matches backend HD wallet Account struct)
export interface Account {
  id: string;
  name: string;
  address: string;
  chain: Chain;
  derivationPath: string;
  balance?: string;
  accountIndex: number;
}

// Wallet state for the application
export interface Wallet {
  id: string;
  name: string;
  isLocked: boolean;
  accounts: Account[];
  createdAt: string;
}

// Balance information for accounts
export interface Balance {
  accountId: string;
  chain: Chain;
  nativeBalance: string; // ETH, SOL, BTC
  formattedBalance: string;
  usdValue?: string;
  lastUpdated: string;
}

// Token information (ERC-20, SPL tokens)
export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
  chain: Chain;
  balance?: string;
  usdValue?: string;
}

// Transaction information
export interface Transaction {
  id: string;
  hash: string;
  from: string;
  to: string;
  amount: string;
  chain: Chain;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: string;
  gasUsed?: string;
  gasPrice?: string;
  blockNumber?: number;
}

// Chain configuration
export interface ChainConfig {
  id: Chain;
  name: string;
  symbol: string;
  decimals: number;
  rpcUrl: string;
  explorerUrl: string;
  isTestnet: boolean;
  logoUrl?: string;
}

// Wallet creation/import forms
export interface CreateWalletForm {
  walletName: string;
  password: string;
  confirmPassword: string;
}

export interface ImportWalletForm {
  walletName: string;
  mnemonic: string;
  password: string;
  confirmPassword: string;
}

// API response types (for backend communication)
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateWalletResponse {
  walletId: string;
  mnemonic: string;
  accounts: Account[];
}

export interface UnlockWalletResponse {
  success: boolean;
  accounts: Account[];
}

// Error types
export interface WalletError {
  code: string;
  message: string;
  details?: any;
}