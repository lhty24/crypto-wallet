import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';
import { sanitizeMessage, showSuccess, showError, showWarning, showInfo } from '../toast';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// --- sanitizeMessage ---

describe('sanitizeMessage', () => {
  it('passes safe messages through unchanged', () => {
    expect(sanitizeMessage('Failed to create wallet')).toBe('Failed to create wallet');
    expect(sanitizeMessage('Wallet unlocked')).toBe('Wallet unlocked');
    expect(sanitizeMessage('')).toBe('');
  });

  it('redacts hex private keys (0x + 64 hex chars)', () => {
    const msg = 'Error with key 0x' + 'a'.repeat(64);
    expect(sanitizeMessage(msg)).toBe('An error occurred');
  });

  it('redacts mnemonic-like phrases (12 lowercase words)', () => {
    const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    expect(sanitizeMessage(mnemonic)).toBe('An error occurred');
  });

  it('redacts mnemonic-like phrases (24 lowercase words)', () => {
    const words = Array(24).fill('zoo').join(' ');
    expect(sanitizeMessage(words)).toBe('An error occurred');
  });

  it('redacts long base58 strings (potential keys)', () => {
    // Simulated Solana public key (44 chars base58)
    const base58Key = '5YNmS1R9nNSCDzb5a7mMJ1dwK9uHeAAF4CerPJqS3Fug';
    expect(sanitizeMessage(`Error: ${base58Key}`)).toBe('An error occurred');
  });

  it('redacts messages containing "private key"', () => {
    expect(sanitizeMessage('Could not load private key')).toBe('An error occurred');
  });

  it('redacts messages containing "mnemonic"', () => {
    expect(sanitizeMessage('Invalid mnemonic provided')).toBe('An error occurred');
  });

  it('redacts messages containing "seed phrase"', () => {
    expect(sanitizeMessage('Your seed phrase is invalid')).toBe('An error occurred');
  });

  it('redacts messages containing "secret key"', () => {
    expect(sanitizeMessage('secret key not found')).toBe('An error occurred');
  });

  it('is case-insensitive for sensitive keywords', () => {
    expect(sanitizeMessage('PRIVATE KEY error')).toBe('An error occurred');
    expect(sanitizeMessage('Seed Phrase invalid')).toBe('An error occurred');
  });

  it('does not redact short base58 strings (addresses are OK)', () => {
    // Short base58 strings (< 40 chars) like tx hashes or short identifiers are fine
    const shortStr = 'abc123XYZ';
    expect(sanitizeMessage(`Tx ${shortStr} failed`)).toBe(`Tx ${shortStr} failed`);
  });

  it('does not redact fewer than 12 lowercase words', () => {
    expect(sanitizeMessage('the quick brown fox jumps over')).toBe('the quick brown fox jumps over');
  });
});

// --- showSuccess ---

describe('showSuccess', () => {
  it('calls toast.success with sanitized message and 4s duration', () => {
    showSuccess('Wallet created');
    expect(toast.success).toHaveBeenCalledWith('Wallet created', { duration: 4000 });
  });

  it('sanitizes the message', () => {
    showSuccess('Error 0x' + 'f'.repeat(64));
    expect(toast.success).toHaveBeenCalledWith('An error occurred', { duration: 4000 });
  });

  it('sanitizes the description', () => {
    showSuccess('Done', { description: 'secret key stored' });
    expect(toast.success).toHaveBeenCalledWith('Done', {
      description: 'An error occurred',
      duration: 4000,
    });
  });
});

// --- showError ---

describe('showError', () => {
  it('calls toast.error with sanitized message and 6s duration', () => {
    showError('Connection failed');
    expect(toast.error).toHaveBeenCalledWith('Connection failed', { duration: 6000 });
  });

  it('sanitizes the message', () => {
    const mnemonic = Array(12).fill('word').join(' ');
    showError(mnemonic);
    expect(toast.error).toHaveBeenCalledWith('An error occurred', { duration: 6000 });
  });
});

// --- showWarning ---

describe('showWarning', () => {
  it('calls toast.warning with sanitized message and 5s duration', () => {
    showWarning('Backend sync failed');
    expect(toast.warning).toHaveBeenCalledWith('Backend sync failed', { duration: 5000 });
  });
});

// --- showInfo ---

describe('showInfo', () => {
  it('calls toast.info with sanitized message and 4s duration', () => {
    showInfo('Wallet locked');
    expect(toast.info).toHaveBeenCalledWith('Wallet locked', { duration: 4000 });
  });
});
