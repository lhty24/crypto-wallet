import { describe, it, expect } from 'vitest';
import {
  validateWalletName,
  validatePassword,
  pickRandomIndices,
  verifyMnemonicWords,
} from '../validation';

describe('validateWalletName', () => {
  it('returns error for empty name', () => {
    expect(validateWalletName('')).toBe('Wallet name is required');
    expect(validateWalletName('   ')).toBe('Wallet name is required');
  });

  it('returns error for name over 32 characters', () => {
    const longName = 'a'.repeat(33);
    expect(validateWalletName(longName)).toBe('Wallet name must be 32 characters or less');
  });

  it('returns null for valid name', () => {
    expect(validateWalletName('My Wallet')).toBeNull();
    expect(validateWalletName('a')).toBeNull();
    expect(validateWalletName('a'.repeat(32))).toBeNull();
  });
});

describe('validatePassword', () => {
  it('returns error for password under 8 characters', () => {
    expect(validatePassword('short', 'short')).toBe('Password must be at least 8 characters');
  });

  it('returns error when passwords do not match', () => {
    expect(validatePassword('password123', 'password456')).toBe('Passwords do not match');
  });

  it('returns null for valid matching passwords', () => {
    expect(validatePassword('password123', 'password123')).toBeNull();
  });
});

describe('pickRandomIndices', () => {
  it('returns the correct number of indices', () => {
    const indices = pickRandomIndices(12, 3);
    expect(indices).toHaveLength(3);
  });

  it('returns no duplicate indices', () => {
    const indices = pickRandomIndices(12, 3);
    const unique = new Set(indices);
    expect(unique.size).toBe(3);
  });

  it('returns indices within range', () => {
    const indices = pickRandomIndices(12, 3);
    for (const idx of indices) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(12);
    }
  });

  it('returns sorted indices', () => {
    const indices = pickRandomIndices(12, 3);
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
  });
});

describe('verifyMnemonicWords', () => {
  const words = ['abandon', 'ability', 'able', 'about', 'above', 'absent',
                 'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident'];

  it('returns true when all words match', () => {
    const indices = [0, 5, 11];
    const inputs = { 0: 'abandon', 5: 'absent', 11: 'accident' };
    expect(verifyMnemonicWords(words, indices, inputs)).toBe(true);
  });

  it('returns true for case-insensitive match', () => {
    const indices = [0, 5, 11];
    const inputs = { 0: 'ABANDON', 5: 'Absent', 11: 'ACCIDENT' };
    expect(verifyMnemonicWords(words, indices, inputs)).toBe(true);
  });

  it('returns true when inputs have extra whitespace', () => {
    const indices = [0];
    const inputs = { 0: '  abandon  ' };
    expect(verifyMnemonicWords(words, indices, inputs)).toBe(true);
  });

  it('returns false when a word is wrong', () => {
    const indices = [0, 5, 11];
    const inputs = { 0: 'abandon', 5: 'wrong', 11: 'accident' };
    expect(verifyMnemonicWords(words, indices, inputs)).toBe(false);
  });

  it('returns false when an input is missing', () => {
    const indices = [0, 5, 11];
    const inputs = { 0: 'abandon', 5: 'absent' };
    expect(verifyMnemonicWords(words, indices, inputs)).toBe(false);
  });
});
