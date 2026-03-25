/**
 * Security-sanitized toast notification wrapper around Sonner.
 *
 * All toast messages pass through sanitizeMessage() to ensure
 * sensitive data (private keys, mnemonics, seeds) never appears
 * in user-visible notifications.
 */

import { toast } from 'sonner';

// --- Sensitive data patterns ---

// Hex private key: 0x followed by 64 hex chars
const HEX_KEY_PATTERN = /0x[a-fA-F0-9]{64}/;

// Mnemonic-like: 12 or more consecutive lowercase words
const MNEMONIC_PATTERN = /(?:^|\s)(?:[a-z]+\s){11,}[a-z]+(?:\s|$)/;

// Long base58 string (potential Solana/Bitcoin key): 40+ base58 chars
const BASE58_KEY_PATTERN = /[1-9A-HJ-NP-Za-km-z]{40,}/;

// Sensitive keywords appearing in the message
const SENSITIVE_KEYWORDS = /private\s*key|mnemonic|seed\s*phrase|secret\s*key/i;

const SAFE_FALLBACK = 'An error occurred';

/**
 * Check if a message contains sensitive cryptographic data.
 * Returns sanitized message or original if safe.
 */
export function sanitizeMessage(message: string): string {
  if (!message) return message;

  if (
    HEX_KEY_PATTERN.test(message) ||
    MNEMONIC_PATTERN.test(message) ||
    BASE58_KEY_PATTERN.test(message) ||
    SENSITIVE_KEYWORDS.test(message)
  ) {
    return SAFE_FALLBACK;
  }

  return message;
}

// --- Toast option types ---

interface ToastOptions {
  description?: string;
}

function sanitizeOptions(opts?: ToastOptions): ToastOptions | undefined {
  if (!opts?.description) return opts;
  return { ...opts, description: sanitizeMessage(opts.description) };
}

// --- Exported toast functions ---

export function showSuccess(message: string, opts?: ToastOptions): void {
  toast.success(sanitizeMessage(message), {
    ...sanitizeOptions(opts),
    duration: 4000,
  });
}

export function showError(message: string, opts?: ToastOptions): void {
  toast.error(sanitizeMessage(message), {
    ...sanitizeOptions(opts),
    duration: 6000,
  });
}

export function showWarning(message: string, opts?: ToastOptions): void {
  toast.warning(sanitizeMessage(message), {
    ...sanitizeOptions(opts),
    duration: 5000,
  });
}

export function showInfo(message: string, opts?: ToastOptions): void {
  toast.info(sanitizeMessage(message), {
    ...sanitizeOptions(opts),
    duration: 4000,
  });
}
