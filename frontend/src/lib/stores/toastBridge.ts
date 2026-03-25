/**
 * Toast bridge: subscribes to walletStore error/warning state
 * and surfaces changes as toast notifications.
 *
 * Call initToastBridge() once at app startup (e.g., in Providers).
 */

import { useWalletStore } from '@/lib/stores/walletStore';
import { showError, showWarning } from '@/lib/utils/toast';

let initialized = false;

export function initToastBridge(): void {
  if (initialized) return;
  initialized = true;

  useWalletStore.subscribe(
    (state) => state.error,
    (error) => {
      if (error) {
        showError(error.message);
      }
    },
  );

  useWalletStore.subscribe(
    (state) => state.warning,
    (warning) => {
      if (warning) {
        showWarning(warning);
      }
    },
  );
}
