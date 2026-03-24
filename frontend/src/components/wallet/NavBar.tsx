'use client';

import { useWallet, useIsUnlocked } from '@/lib/stores/walletStore';
import { lockWallet } from '@/lib/storage/walletService';

export default function NavBar() {
  const wallet = useWallet();
  const isUnlocked = useIsUnlocked();

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              CryptoWallet
            </h1>
            {wallet && (
              <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">
                {wallet.name}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isUnlocked ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {isUnlocked ? 'Unlocked' : 'Locked'}
              </span>
            </div>
            {isUnlocked && (
              <button
                onClick={() => lockWallet()}
                className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200
                           font-medium transition-colors"
              >
                Lock
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
