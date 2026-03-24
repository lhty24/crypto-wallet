'use client';

import { useState, useEffect, useCallback } from 'react';
import { loadWallets, deleteWalletById, resetActivity } from '@/lib/storage/walletService';
import type { StoredWallet } from '@/lib/storage/indexedDB';
import WalletList from './WalletList';
import UnlockPrompt from './UnlockPrompt';
import WalletDetail from './WalletDetail';

type DashboardState = 'list' | 'unlock' | 'detail';

interface WalletDashboardProps {
  onCreateWallet: () => void;
  onImportWallet: () => void;
}

export default function WalletDashboard({ onCreateWallet, onImportWallet }: WalletDashboardProps) {
  const [state, setState] = useState<DashboardState>('list');
  const [wallets, setWallets] = useState<StoredWallet[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);

  const refreshWallets = useCallback(async () => {
    const loaded = await loadWallets();
    setWallets(loaded);
  }, []);

  useEffect(() => {
    refreshWallets();
  }, [refreshWallets]);

  // Wire up activity tracking for auto-lock while unlocked
  useEffect(() => {
    if (state !== 'detail') return;

    const handleActivity = () => resetActivity();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [state]);

  const handleSelectWallet = (walletId: string) => {
    setSelectedWalletId(walletId);
    setState('unlock');
  };

  const handleUnlocked = () => {
    setState('detail');
  };

  const handleLocked = () => {
    setSelectedWalletId(null);
    setState('list');
    refreshWallets();
  };

  const handleCancelUnlock = () => {
    setSelectedWalletId(null);
    setState('list');
  };

  const handleDeleteWallet = async (walletId: string) => {
    await deleteWalletById(walletId);
    await refreshWallets();
  };

  const selectedWallet = wallets.find((w) => w.id === selectedWalletId);

  if (state === 'unlock' && selectedWallet) {
    return (
      <UnlockPrompt
        walletId={selectedWallet.id}
        walletName={selectedWallet.name}
        onUnlocked={handleUnlocked}
        onCancel={handleCancelUnlock}
      />
    );
  }

  if (state === 'detail') {
    return <WalletDetail onLocked={handleLocked} />;
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Wallets</h2>
        <div className="flex gap-2">
          <button
            onClick={onCreateWallet}
            className="bg-blue-600 hover:bg-blue-700
                       text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
          >
            Create New
          </button>
          <button
            onClick={onImportWallet}
            className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600
                       text-gray-900 dark:text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
          >
            Import
          </button>
        </div>
      </div>

      <WalletList
        wallets={wallets}
        onSelectWallet={handleSelectWallet}
        onDeleteWallet={handleDeleteWallet}
      />
    </div>
  );
}
