'use client';

import { useState, useCallback } from 'react';
import { unlockWallet } from '@/lib/storage/walletService';
import { showError } from '@/lib/utils/toast';

interface UnlockPromptProps {
  walletId: string;
  walletName: string;
  onUnlocked: () => void;
  onCancel: () => void;
}

export default function UnlockPrompt({ walletId, walletName, onUnlocked, onCancel }: UnlockPromptProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!password) {
      setError('Password is required');
      return;
    }

    setError(null);
    setIsUnlocking(true);

    try {
      await unlockWallet(walletId, password);
      onUnlocked();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to unlock wallet';
      setError(msg);
      showError(msg);
    } finally {
      setIsUnlocking(false);
    }
  }, [walletId, password, onUnlocked]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Unlock Wallet</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Enter your password to unlock <span className="font-semibold">{walletName}</span>.
        </p>
      </div>

      <div>
        <label htmlFor="unlock-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Password
        </label>
        <input
          id="unlock-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your wallet password"
          autoFocus
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600
                     rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600
                     text-gray-900 dark:text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isUnlocking}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                     text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {isUnlocking ? 'Unlocking...' : 'Unlock'}
        </button>
      </div>
    </div>
  );
}
