/**
 * Ethereum RPC Module — Direct blockchain communication via Viem
 *
 * Provides balance fetching, gas estimation, nonce queries, and transaction
 * broadcasting by talking directly to Ethereum RPC nodes. This implements
 * the "Write-Direct" side of the Write-Direct, Read-Indexed pattern.
 *
 * All operations are read-only or use pre-signed transactions —
 * no private keys are involved.
 */

import {
  createPublicClient,
  http,
  formatEther,
  formatGwei,
  type PublicClient,
} from 'viem';
import { mainnet, sepolia } from 'viem/chains';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_RPC_URL = 'https://eth.llamarpc.com';

function getRpcUrl(): string {
  return process.env.NEXT_PUBLIC_ETH_RPC_URL || DEFAULT_RPC_URL;
}

function getChain() {
  const url = getRpcUrl();
  return url.includes('sepolia') ? sepolia : mainnet;
}

// ============================================================================
// Singleton client
// ============================================================================

let clientInstance: PublicClient | null = null;
let currentRpcUrl: string | null = null;

export function getEthClient(): PublicClient {
  const rpcUrl = getRpcUrl();
  if (!clientInstance || currentRpcUrl !== rpcUrl) {
    clientInstance = createPublicClient({
      chain: getChain(),
      transport: http(rpcUrl),
    });
    currentRpcUrl = rpcUrl;
  }
  return clientInstance;
}

/** Reset client singleton — exported for tests only. */
export function _resetClient(): void {
  clientInstance = null;
  currentRpcUrl = null;
}

// ============================================================================
// Balance
// ============================================================================

export async function getEthBalance(
  address: string
): Promise<{ balance: string; formatted: string } | null> {
  try {
    const client = getEthClient();
    const wei = await client.getBalance({ address: address as `0x${string}` });
    return {
      balance: wei.toString(),
      formatted: formatEther(wei),
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Gas Estimation
// ============================================================================

export interface GasEstimate {
  gasPrice: bigint;
  formattedGasPrice: string;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  estimatedGas?: bigint;
}

export async function estimateEthGas(params?: {
  from: string;
  to: string;
  value?: bigint;
  data?: string;
}): Promise<GasEstimate | null> {
  try {
    const client = getEthClient();
    const gasPrice = await client.getGasPrice();

    const result: GasEstimate = {
      gasPrice,
      formattedGasPrice: formatGwei(gasPrice),
    };

    if (params) {
      const gas = await client.estimateGas({
        account: params.from as `0x${string}`,
        to: params.to as `0x${string}`,
        value: params.value,
        data: params.data as `0x${string}` | undefined,
      });
      result.estimatedGas = gas;
    }

    // Try EIP-1559 fee data
    try {
      const block = await client.getBlock();
      if (block.baseFeePerGas) {
        result.maxPriorityFeePerGas = BigInt(1_500_000_000); // 1.5 Gwei default tip
        result.maxFeePerGas =
          block.baseFeePerGas * BigInt(2) + result.maxPriorityFeePerGas;
      }
    } catch {
      // Pre-EIP-1559 chain — gasPrice is sufficient
    }

    return result;
  } catch {
    return null;
  }
}

// ============================================================================
// Nonce
// ============================================================================

export async function getEthNonce(address: string): Promise<number | null> {
  try {
    const client = getEthClient();
    const nonce = await client.getTransactionCount({
      address: address as `0x${string}`,
    });
    return nonce;
  } catch {
    return null;
  }
}

// ============================================================================
// Broadcast
// ============================================================================

export async function broadcastEthTransaction(
  signedTx: string
): Promise<string | null> {
  try {
    const client = getEthClient();
    const hash = await client.sendRawTransaction({
      serializedTransaction: signedTx as `0x${string}`,
    });
    return hash;
  } catch {
    return null;
  }
}
