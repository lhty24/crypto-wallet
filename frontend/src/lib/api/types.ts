/**
 * API Types for Backend Communication
 *
 * These types define the contract between frontend and backend.
 * All fields use snake_case to match Rust/serde serialization.
 *
 * SECURITY NOTE: These types intentionally exclude sensitive data
 * (mnemonics, passwords, private keys). The backend only receives
 * metadata - all crypto operations happen client-side.
 */

// ============================================================================
// Generic API Response Wrapper
// ============================================================================

/**
 * Discriminated union for API results.
 * TypeScript can narrow the type based on the 'success' field.
 */
export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

// ============================================================================
// Wallet Types
// ============================================================================

/**
 * Request to create a new wallet.
 * Only sends the name - mnemonic is generated client-side.
 */
export interface CreateWalletRequest {
  name: string;
}

/**
 * Request to import an existing wallet.
 * Only sends the name - mnemonic is handled client-side.
 */
export interface ImportWalletRequest {
  name: string;
}

/**
 * Request to update wallet metadata.
 */
export interface UpdateWalletRequest {
  name: string;
}

/**
 * Response for wallet operations (create, import, update, get).
 * Matches backend WalletResponse struct.
 */
export interface WalletResponse {
  wallet_id: string;
  name: string;
  created_at: string; // ISO 8601 timestamp
  message: string;
}

/**
 * Response for wallet deletion.
 */
export interface DeleteWalletResponse {
  wallet_id: string;
  message: string;
  deleted: boolean;
}

// ============================================================================
// Address Types
// ============================================================================

/**
 * Request to register a derived address with the backend.
 * Addresses are public data - safe to send to backend for indexing.
 */
export interface RegisterAddressRequest {
  address: string; // The blockchain address (e.g., "0x..." or "bc1...")
  chain: string; // "bitcoin", "ethereum", "solana"
  derivation_path: string; // BIP44 path (e.g., "m/44'/60'/0'/0/0")
}

/**
 * Response after registering an address.
 */
export interface AddressResponse {
  id: number;
  wallet_id: string;
  address: string;
  chain: string;
  derivation_path: string;
  created_at: string;
  message: string;
}

// ============================================================================
// Balance Types
// ============================================================================

/**
 * Balance information for a single address.
 */
export interface AddressBalance {
  address: string;
  chain: string;
  balance: string; // String to preserve precision (e.g., "1.234567890123456789")
  symbol: string; // "ETH", "BTC", "SOL"
  timestamp: string; // When balance was fetched
}

/**
 * Response for wallet balance endpoint.
 */
export interface WalletBalanceResponse {
  wallet_id: string;
  balances: AddressBalance[];
}

// ============================================================================
// Transaction Types
// ============================================================================

/**
 * A blockchain transaction record.
 */
export interface Transaction {
  hash: string;
  from: string;
  to: string;
  amount: string;
  chain: string;
  symbol: string;
  status: "confirmed" | "pending" | "failed";
  timestamp: string;
  block_number: string | null; // null if pending
}

/**
 * Response for transaction history endpoint.
 */
export interface WalletTransactionResponse {
  wallet_id: string;
  transactions: Transaction[];
}

// ============================================================================
// Broadcast Types
// ============================================================================

/**
 * Request to broadcast a signed transaction.
 * Frontend signs the transaction, backend broadcasts to blockchain.
 */
export interface BroadcastTransactionRequest {
  signed_tx: string; // Hex-encoded signed transaction
  chain: string;
}

/**
 * Response after broadcasting a transaction.
 */
export interface BroadcastTransactionResponse {
  tx_hash: string;
  chain: string;
  status: string;
  message: string;
}

// ============================================================================
// Supported Chains
// ============================================================================

/**
 * Supported blockchain identifiers.
 * Used for type safety when specifying chains.
 */
export type SupportedChain = "bitcoin" | "ethereum" | "solana";

/**
 * Type guard to check if a string is a supported chain.
 */
export function isSupportedChain(chain: string): chain is SupportedChain {
  return ["bitcoin", "ethereum", "solana"].includes(chain.toLowerCase());
}
