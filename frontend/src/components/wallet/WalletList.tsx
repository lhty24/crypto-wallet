'use client';

import { useState } from 'react';
import type { StoredWallet } from '@/lib/storage/indexedDB';

interface WalletListProps {
  wallets: StoredWallet[];
  onSelectWallet: (walletId: string) => void;
  onDeleteWallet: (walletId: string) => void;
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function WalletList({ wallets, onSelectWallet, onDeleteWallet }: WalletListProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = (walletId: string) => {
    if (confirmDeleteId === walletId) {
      onDeleteWallet(walletId);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(walletId);
    }
  };

  return (
    <div className="space-y-4">
      {wallets.map((wallet) => (
        <div
          key={wallet.id}
          className="bg-white dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{wallet.name}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Created {formatDate(wallet.createdAt)}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Locked</span>
            </div>
          </div>

          <div className="space-y-1 mb-4">
            {wallet.addresses.ethereum && (
              <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                ETH: {truncateAddress(wallet.addresses.ethereum)}
              </p>
            )}
            {wallet.addresses.bitcoin && (
              <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                BTC: {truncateAddress(wallet.addresses.bitcoin)}
              </p>
            )}
            {wallet.addresses.solana && (
              <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                SOL: {truncateAddress(wallet.addresses.solana)}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => onSelectWallet(wallet.id)}
              className="flex-1 bg-blue-600 hover:bg-blue-700
                         text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
            >
              Unlock
            </button>
            <button
              onClick={() => handleDelete(wallet.id)}
              className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500
                         text-gray-700 dark:text-gray-200 font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
            >
              {confirmDeleteId === wallet.id ? 'Confirm Delete' : 'Delete'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
