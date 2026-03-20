/**
 * Session Manager - Auto-lock timer and activity tracking
 *
 * This module manages the security timeout that automatically locks
 * the wallet after a period of inactivity.
 *
 * How it works:
 * 1. When wallet unlocks, startAutoLock() begins countdown
 * 2. User activity (clicks, keypresses) calls resetActivity()
 * 3. If countdown expires, onLock callback is called
 * 4. When wallet locks, stopAutoLock() clears the timer
 */

// Default timeout: 5 minutes (in milliseconds)
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

// Module-level state (not exported - internal only)
let autoLockTimerId: ReturnType<typeof setTimeout> | null = null;
let lastActivityTime: number = Date.now();
let currentTimeoutMs: number = DEFAULT_TIMEOUT_MS;
let onLockCallback: (() => void) | null = null;

/**
 * Creates the auto-lock timeout
 *
 * Internal helper to avoid duplicating setTimeout logic.
 * When timeout expires, calls the onLockCallback if set.
 */
function createTimer(): void {
  autoLockTimerId = setTimeout(() => {
    if (onLockCallback) {
      onLockCallback();
    }
  }, currentTimeoutMs);
}

/**
 * Starts the auto-lock countdown timer
 *
 * Call this when the wallet is unlocked. When the timer expires,
 * the onLock callback will be executed to lock the wallet.
 *
 * @param timeoutMs - Time in milliseconds before auto-lock (default: 5 minutes)
 * @param onLock - Callback function to execute when timer expires (typically lockWallet)
 */
export function startAutoLock(
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  onLock: () => void
): void {
  // Clear any existing timer before starting a new one
  stopAutoLock();

  currentTimeoutMs = timeoutMs;
  onLockCallback = onLock;
  lastActivityTime = Date.now();

  createTimer();
}

/**
 * Resets the auto-lock timer due to user activity
 *
 * Call this on user interactions (clicks, keypresses, mouse moves, etc.)
 * to prevent the wallet from locking while user is active.
 * Does nothing if no timer is currently running.
 */
export function resetActivity(): void {
  // Only reset if we have an active timer and callback
  if (autoLockTimerId === null || onLockCallback === null) {
    return;
  }

  lastActivityTime = Date.now();

  // Clear old timer and start fresh countdown
  clearTimeout(autoLockTimerId);
  createTimer();
}

/**
 * Stops the auto-lock timer completely
 *
 * Call this when the wallet is locked (no need to track activity
 * when already locked).
 */
export function stopAutoLock(): void {
  if (autoLockTimerId !== null) {
    clearTimeout(autoLockTimerId);
    autoLockTimerId = null;
  }
  onLockCallback = null;
}

/**
 * Gets the time of last user activity
 *
 * @returns Unix timestamp (milliseconds) of last activity
 */
export function getLastActivityTime(): number {
  return lastActivityTime;
}

/**
 * Checks if the auto-lock timer is currently running
 *
 * @returns true if timer is active, false otherwise
 */
export function isAutoLockActive(): boolean {
  return autoLockTimerId !== null;
}
