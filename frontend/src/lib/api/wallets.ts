/**
 * Wallet API - Named functions for all wallet-related backend calls
 *
 * This module maps directly to the backend routes in server.rs:
 *
 *   GET    /wallets                     → listWallets()
 *   POST   /wallet/create              → createWallet()
 *   POST   /wallet/import              → importWallet()
 *   PUT    /wallet/{id}                → updateWallet()
 *   DELETE /wallet/{id}                → deleteWallet()
 *   POST   /wallet/{id}/addresses      → registerAddress()
 *   GET    /wallet/{id}/balance        → getBalance()
 *   GET    /wallet/{id}/transactions   → getTransactions()
 */

import { get, post, put, del } from "./client";
import {
  type ApiResult,
  type CreateWalletRequest,
  type ImportWalletRequest,
  type UpdateWalletRequest,
  type RegisterAddressRequest,
  type WalletResponse,
  type DeleteWalletResponse,
  type AddressResponse,
  type WalletBalanceResponse,
  type WalletTransactionResponse,
} from "./types";

// ============================================================================
// Wallet CRUD
// ============================================================================

/**
 * Register new wallet metadata with the backend.
 *
 * The backend generates a wallet_id (UUID) and stores name + timestamp.
 * The mnemonic is generated client-side (Task 1) and NEVER sent here.
 *
 * Call this AFTER createWallet() from walletService.ts succeeds locally.
 */
export function createWallet(
  request: CreateWalletRequest
): Promise<ApiResult<WalletResponse>> {
  return post<WalletResponse>("/wallet/create", request);
}

/**
 * Register imported wallet metadata with the backend.
 *
 * Identical to createWallet() from the backend's perspective -
 * both just store a name. The distinction is semantic (and logged differently).
 *
 * Call this AFTER importWallet() from walletService.ts succeeds locally.
 */
export function importWallet(
  request: ImportWalletRequest
): Promise<ApiResult<WalletResponse>> {
  return post<WalletResponse>("/wallet/import", request);
}

/**
 * Fetch all wallet metadata records from the backend.
 *
 * Returns an array - the backend returns [] when no wallets exist.
 * Use this to sync backend metadata with locally stored wallets.
 */
export function listWallets(): Promise<ApiResult<WalletResponse[]>> {
  return get<WalletResponse[]>("/wallets");
}

/**
 * Update the display name of a wallet.
 *
 * @param walletId - The UUID returned by createWallet() or importWallet()
 */
export function updateWallet(
  walletId: string,
  request: UpdateWalletRequest
): Promise<ApiResult<WalletResponse>> {
  return put<WalletResponse>(`/wallet/${walletId}`, request);
}

/**
 * Delete wallet metadata from the backend.
 *
 * This only removes the backend record - local IndexedDB data must
 * be deleted separately via deleteWalletById() from walletService.ts.
 *
 * @param walletId - The UUID of the wallet to delete
 */
export function deleteWallet(
  walletId: string
): Promise<ApiResult<DeleteWalletResponse>> {
  return del<DeleteWalletResponse>(`/wallet/${walletId}`);
}

// ============================================================================
// Address Registration
// ============================================================================

/**
 * Register a derived blockchain address with the backend.
 *
 * Public addresses are safe to store server-side - the backend uses them
 * for balance indexing and transaction history.
 *
 * Call this once per chain after wallet creation/import and unlock.
 *
 * @param walletId - The UUID of the wallet this address belongs to
 *
 * @example
 * await registerAddress(walletId, {
 *   address: "0x742d35Cc...",
 *   chain: "ethereum",
 *   derivation_path: "m/44'/60'/0'/0/0",
 * });
 */
export function registerAddress(
  walletId: string,
  request: RegisterAddressRequest
): Promise<ApiResult<AddressResponse>> {
  return post<AddressResponse>(`/wallet/${walletId}/addresses`, request);
}

// ============================================================================
// Balance & Transaction History
// ============================================================================

/**
 * Fetch current balances for all registered addresses in a wallet.
 *
 * Currently returns mock data (0.0) - real RPC integration comes in Phase 2.
 *
 * @param walletId - The UUID of the wallet
 */
export function getBalance(
  walletId: string
): Promise<ApiResult<WalletBalanceResponse>> {
  return get<WalletBalanceResponse>(`/wallet/${walletId}/balance`);
}

/**
 * Fetch transaction history for all registered addresses in a wallet.
 *
 * Currently returns an empty array - real blockchain indexing comes in Phase 2.
 *
 * @param walletId - The UUID of the wallet
 */
export function getTransactions(
  walletId: string
): Promise<ApiResult<WalletTransactionResponse>> {
  return get<WalletTransactionResponse>(`/wallet/${walletId}/transactions`);
}
