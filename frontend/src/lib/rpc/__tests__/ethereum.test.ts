import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

const mockGetBalance = vi.fn();
const mockGetGasPrice = vi.fn();
const mockEstimateGas = vi.fn();
const mockGetTransactionCount = vi.fn();
const mockSendRawTransaction = vi.fn();
const mockGetBlock = vi.fn();

vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      getBalance: mockGetBalance,
      getGasPrice: mockGetGasPrice,
      estimateGas: mockEstimateGas,
      getTransactionCount: mockGetTransactionCount,
      sendRawTransaction: mockSendRawTransaction,
      getBlock: mockGetBlock,
    })),
  };
});

// Import after mocks
import {
  getEthClient,
  getEthBalance,
  estimateEthGas,
  getEthNonce,
  broadcastEthTransaction,
  _resetClient,
} from '../ethereum';
import { createPublicClient } from 'viem';

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  _resetClient();
  vi.mocked(createPublicClient).mockClear();
  mockGetBalance.mockReset();
  mockGetGasPrice.mockReset();
  mockEstimateGas.mockReset();
  mockGetTransactionCount.mockReset();
  mockSendRawTransaction.mockReset();
  mockGetBlock.mockReset();
});

// ============================================================================
// getEthClient
// ============================================================================

describe('getEthClient', () => {
  it('creates a PublicClient via createPublicClient', () => {
    getEthClient();
    expect(createPublicClient).toHaveBeenCalled();
  });

  it('reuses the same client on subsequent calls', () => {
    const client1 = getEthClient();
    const client2 = getEthClient();
    expect(client1).toBe(client2);
    expect(createPublicClient).toHaveBeenCalledTimes(1);
  });

  it('creates a new client after _resetClient()', () => {
    getEthClient();
    _resetClient();
    getEthClient();
    expect(createPublicClient).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// getEthBalance
// ============================================================================

describe('getEthBalance', () => {
  it('returns formatted balance for a valid address', async () => {
    mockGetBalance.mockResolvedValue(1_500_000_000_000_000_000n); // 1.5 ETH

    const result = await getEthBalance('0x1234567890abcdef1234567890abcdef12345678');

    expect(result).not.toBeNull();
    expect(result!.balance).toBe('1500000000000000000');
    expect(result!.formatted).toBe('1.5');
  });

  it('returns null on RPC error', async () => {
    mockGetBalance.mockRejectedValue(new Error('RPC timeout'));

    const result = await getEthBalance('0x1234567890abcdef1234567890abcdef12345678');

    expect(result).toBeNull();
  });

  it('handles zero balance', async () => {
    mockGetBalance.mockResolvedValue(0n);

    const result = await getEthBalance('0x1234567890abcdef1234567890abcdef12345678');

    expect(result).not.toBeNull();
    expect(result!.balance).toBe('0');
    expect(result!.formatted).toBe('0');
  });

  it('passes address to client.getBalance', async () => {
    mockGetBalance.mockResolvedValue(0n);

    await getEthBalance('0xABCD');

    expect(mockGetBalance).toHaveBeenCalledWith({ address: '0xABCD' });
  });
});

// ============================================================================
// estimateEthGas
// ============================================================================

describe('estimateEthGas', () => {
  it('returns gas price without tx params', async () => {
    mockGetGasPrice.mockResolvedValue(20_000_000_000n); // 20 Gwei
    mockGetBlock.mockResolvedValue({ baseFeePerGas: 15_000_000_000n });

    const result = await estimateEthGas();

    expect(result).not.toBeNull();
    expect(result!.gasPrice).toBe(20_000_000_000n);
    expect(result!.formattedGasPrice).toBe('20');
    expect(result!.estimatedGas).toBeUndefined();
  });

  it('includes estimatedGas when tx params provided', async () => {
    mockGetGasPrice.mockResolvedValue(20_000_000_000n);
    mockEstimateGas.mockResolvedValue(21_000n);
    mockGetBlock.mockResolvedValue({ baseFeePerGas: 15_000_000_000n });

    const result = await estimateEthGas({
      from: '0xSender',
      to: '0xReceiver',
      value: 1_000_000_000_000_000_000n,
    });

    expect(result).not.toBeNull();
    expect(result!.estimatedGas).toBe(21_000n);
  });

  it('includes EIP-1559 fields when baseFeePerGas is available', async () => {
    mockGetGasPrice.mockResolvedValue(20_000_000_000n);
    mockGetBlock.mockResolvedValue({ baseFeePerGas: 15_000_000_000n });

    const result = await estimateEthGas();

    expect(result).not.toBeNull();
    expect(result!.maxPriorityFeePerGas).toBe(1_500_000_000n);
    expect(result!.maxFeePerGas).toBe(
      15_000_000_000n * 2n + 1_500_000_000n // baseFee*2 + tip
    );
  });

  it('omits EIP-1559 fields when baseFeePerGas is null', async () => {
    mockGetGasPrice.mockResolvedValue(20_000_000_000n);
    mockGetBlock.mockResolvedValue({ baseFeePerGas: null });

    const result = await estimateEthGas();

    expect(result).not.toBeNull();
    expect(result!.maxFeePerGas).toBeUndefined();
    expect(result!.maxPriorityFeePerGas).toBeUndefined();
  });

  it('still returns gasPrice if getBlock fails', async () => {
    mockGetGasPrice.mockResolvedValue(20_000_000_000n);
    mockGetBlock.mockRejectedValue(new Error('block fetch failed'));

    const result = await estimateEthGas();

    expect(result).not.toBeNull();
    expect(result!.gasPrice).toBe(20_000_000_000n);
    expect(result!.maxFeePerGas).toBeUndefined();
  });

  it('returns null on RPC error', async () => {
    mockGetGasPrice.mockRejectedValue(new Error('RPC timeout'));

    const result = await estimateEthGas();

    expect(result).toBeNull();
  });
});

// ============================================================================
// getEthNonce
// ============================================================================

describe('getEthNonce', () => {
  it('returns nonce for valid address', async () => {
    mockGetTransactionCount.mockResolvedValue(42);

    const result = await getEthNonce('0x1234567890abcdef1234567890abcdef12345678');

    expect(result).toBe(42);
  });

  it('returns 0 for address with no transactions', async () => {
    mockGetTransactionCount.mockResolvedValue(0);

    const result = await getEthNonce('0x1234567890abcdef1234567890abcdef12345678');

    expect(result).toBe(0);
  });

  it('returns null on RPC error', async () => {
    mockGetTransactionCount.mockRejectedValue(new Error('RPC timeout'));

    const result = await getEthNonce('0x1234567890abcdef1234567890abcdef12345678');

    expect(result).toBeNull();
  });
});

// ============================================================================
// broadcastEthTransaction
// ============================================================================

describe('broadcastEthTransaction', () => {
  it('returns transaction hash on success', async () => {
    mockSendRawTransaction.mockResolvedValue(
      '0xabc123def456789012345678901234567890123456789012345678901234abcd'
    );

    const result = await broadcastEthTransaction('0xSignedTxData');

    expect(result).toBe(
      '0xabc123def456789012345678901234567890123456789012345678901234abcd'
    );
  });

  it('passes serialized transaction to sendRawTransaction', async () => {
    mockSendRawTransaction.mockResolvedValue('0xhash');

    await broadcastEthTransaction('0xRawTx');

    expect(mockSendRawTransaction).toHaveBeenCalledWith({
      serializedTransaction: '0xRawTx',
    });
  });

  it('returns null on broadcast error', async () => {
    mockSendRawTransaction.mockRejectedValue(new Error('nonce too low'));

    const result = await broadcastEthTransaction('0xSignedTxData');

    expect(result).toBeNull();
  });
});
