/**
 * Secure Memory Management
 *
 * Provides best-effort memory cleanup for sensitive data in JavaScript.
 * Note: JavaScript doesn't guarantee memory wiping due to garbage collection,
 * but these utilities minimize the exposure window.
 */

/**
 * Zeros out a Uint8Array buffer
 * Call this after using sensitive data (private keys, seeds)
 *
 * @param buffer - The buffer to zero out
 */
export function zeroBuffer(buffer: Uint8Array): void {
  buffer.fill(0);
}

/**
 * Zeros out multiple buffers at once
 *
 * @param buffers - Array of buffers to zero out
 */
export function zeroBuffers(...buffers: Uint8Array[]): void {
  for (const buffer of buffers) {
    buffer.fill(0);
  }
}

/**
 * Executes a function with a buffer, then zeros it afterward
 * Useful for ensuring cleanup even if the function throws
 */
export async function withSecureCleanup<T>(
  buffer: Uint8Array,
  fn: (buffer: Uint8Array) => T | Promise<T>
): Promise<T> {
  try {
    return await fn(buffer);
  } finally {
    zeroBuffer(buffer);
  }
}
