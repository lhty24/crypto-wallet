import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/utils/toast', () => ({
  showError: vi.fn(),
  showWarning: vi.fn(),
}));

import { useWalletStore } from '@/lib/stores/walletStore';
import { showError, showWarning } from '@/lib/utils/toast';

// Reset store and bridge state between tests
beforeEach(() => {
  vi.clearAllMocks();
  const { actions } = useWalletStore.getState();
  actions.setError(null);
  actions.setWarning(null);
});

describe('toastBridge', () => {
  // Initialize the bridge once for the test suite
  // Use dynamic import to trigger after mocks are in place
  beforeEach(async () => {
    // Re-import to ensure initToastBridge runs with mocks active
    // The guard prevents duplicate subscriptions, but the first import wires it up
    await import('../toastBridge').then((m) => m.initToastBridge());
  });

  it('fires showError when store error is set', () => {
    const { actions } = useWalletStore.getState();
    actions.setError({ code: 'UNLOCK_FAILED', message: 'Wrong password' });

    expect(showError).toHaveBeenCalledWith('Wrong password');
  });

  it('does not fire showError when error is cleared to null', () => {
    const { actions } = useWalletStore.getState();
    actions.setError({ code: 'ERR', message: 'test' });
    vi.clearAllMocks();

    actions.setError(null);
    expect(showError).not.toHaveBeenCalled();
  });

  it('fires showWarning when store warning is set', () => {
    const { actions } = useWalletStore.getState();
    actions.setWarning('Backend sync failed. Will retry on next unlock.');

    expect(showWarning).toHaveBeenCalledWith('Backend sync failed. Will retry on next unlock.');
  });

  it('does not fire showWarning when warning is cleared to null', () => {
    const { actions } = useWalletStore.getState();
    actions.setWarning('some warning');
    vi.clearAllMocks();

    actions.setWarning(null);
    expect(showWarning).not.toHaveBeenCalled();
  });

  it('sanitizes error messages through the toast utility', () => {
    // The sanitization happens inside showError (from toast.ts).
    // Here we verify the bridge passes the message string, not the full WalletError.
    const { actions } = useWalletStore.getState();
    actions.setError({ code: 'DECRYPT_FAILED', message: 'Decryption failed', details: { internal: 'secret' } });

    expect(showError).toHaveBeenCalledWith('Decryption failed');
    // details and code are NOT passed to the toast
    expect(showError).not.toHaveBeenCalledWith(expect.objectContaining({ code: 'DECRYPT_FAILED' }));
  });
});
