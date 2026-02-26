/**
 * API Module - Public exports
 *
 * Import from here rather than from individual files:
 *   import { walletApi } from "@/lib/api";
 *   import type { WalletResponse } from "@/lib/api";
 */

export * from "./types";
export * as walletApi from "./wallets";
export { API_BASE_URL } from "./client";
