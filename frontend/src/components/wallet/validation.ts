'use strict';

export function validateWalletName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'Wallet name is required';
  if (trimmed.length > 32) return 'Wallet name must be 32 characters or less';
  return null;
}

export function validatePassword(password: string, confirmPassword: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (password !== confirmPassword) return 'Passwords do not match';
  return null;
}

export function pickRandomIndices(wordCount: number, pickCount: number): number[] {
  const indices: number[] = [];
  while (indices.length < pickCount) {
    const idx = Math.floor(Math.random() * wordCount);
    if (!indices.includes(idx)) indices.push(idx);
  }
  return indices.sort((a, b) => a - b);
}

export function verifyMnemonicWords(
  words: string[],
  indices: number[],
  inputs: Record<number, string>
): boolean {
  return indices.every(
    (idx) => inputs[idx]?.trim().toLowerCase() === words[idx]?.toLowerCase()
  );
}
