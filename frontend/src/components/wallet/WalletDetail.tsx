'use client';

import { useWallet, useIsUnlocked } from '@/lib/stores/walletStore';
import { lockWallet } from '@/lib/storage/walletService';
import AccountCard from './AccountCard';

interface WalletDetailProps {
  onLocked: () => void;
}

export default function WalletDetail({ onLocked }: WalletDetailProps) {
  const wallet = useWallet();
  const isUnlocked = useIsUnlocked();

  const handleLock = () => {
    lockWallet();
    onLocked();
  };

  if (!wallet || !isUnlocked) {
    return null;
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{wallet.name}</h2>
          <div className="flex items-center space-x-2 mt-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Unlocked</span>
          </div>
        </div>
        <button
          onClick={handleLock}
          className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600
                     text-gray-900 dark:text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
        >
          Lock Wallet
        </button>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Accounts</h3>
        {wallet.accounts.map((account) => (
          <AccountCard
            key={account.id}
            chain={account.chain}
            address={account.address}
            derivationPath={account.derivationPath}
          />
        ))}
      </div>
    </div>
  );
}
