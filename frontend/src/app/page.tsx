'use client';

import { useState, useEffect, useCallback } from 'react';
import CreateWalletFlow from '@/components/wallet/CreateWalletFlow';
import ImportWalletFlow from '@/components/wallet/ImportWalletFlow';
import WalletDashboard from '@/components/wallet/WalletDashboard';
import { loadWallets } from '@/lib/storage/walletService';

type View = 'welcome' | 'create' | 'import' | 'dashboard';

export default function WalletWelcome() {
  const [view, setView] = useState<View>('welcome');
  const [isLoading, setIsLoading] = useState(true);

  const checkWallets = useCallback(async () => {
    try {
      const wallets = await loadWallets();
      if (wallets.length > 0) {
        setView('dashboard');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkWallets();
  }, [checkWallets]);

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <CreateWalletFlow
        onComplete={() => { checkWallets(); setView('dashboard'); }}
        onCancel={() => setView('dashboard')}
      />
    );
  }

  if (view === 'import') {
    return (
      <ImportWalletFlow
        onComplete={() => { checkWallets(); setView('dashboard'); }}
        onCancel={() => setView('dashboard')}
      />
    );
  }

  if (view === 'dashboard') {
    return (
      <WalletDashboard
        onCreateWallet={() => setView('create')}
        onImportWallet={() => setView('import')}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Welcome Header */}
      <div className="text-center mb-12">
        <div className="mb-4">
          <span className="text-6xl">🔐</span>
        </div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Welcome to CryptoWallet
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-md mx-auto">
          Your secure, self-custodial multi-chain cryptocurrency wallet
        </p>
      </div>

      {/* Features Overview */}
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <div className="text-center p-4">
          <div className="text-3xl mb-2">🔒</div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            Secure by Design
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Military-grade encryption with your private keys never leaving your device
          </p>
        </div>

        <div className="text-center p-4">
          <div className="text-3xl mb-2">⛓️</div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            Multi-Chain Support
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage Bitcoin, Ethereum, and Solana from one unified interface
          </p>
        </div>

        <div className="text-center p-4">
          <div className="text-3xl mb-2">🏛️</div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            Self-Custodial
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            You own your keys, you own your coins. No third-party dependencies
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-4 mb-8">
        <button
          onClick={() => setView('create')}
          className="w-full bg-blue-600 hover:bg-blue-700
                     text-white font-semibold py-4 px-6 rounded-lg
                     transition-colors duration-200 flex items-center justify-center"
        >
          <span className="mr-2">✨</span>
          Create New Wallet
        </button>

        <button
          onClick={() => setView('import')}
          className="w-full bg-gray-100 hover:bg-gray-200
                     dark:bg-gray-700 dark:hover:bg-gray-600
                     text-gray-900 dark:text-white font-semibold py-4 px-6 rounded-lg
                     transition-colors duration-200 flex items-center justify-center"
        >
          <span className="mr-2">📥</span>
          Import Existing Wallet
        </button>
      </div>

      {/* Security Notice */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <span className="text-2xl">⚠️</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Security Reminder
            </h3>
            <div className="mt-2 text-sm text-amber-700 dark:text-amber-300">
              <ul className="list-disc pl-5 space-y-1">
                <li>Never share your recovery phrase with anyone</li>
                <li>Store your recovery phrase in a secure, offline location</li>
                <li>Always verify transaction details before signing</li>
                <li>Use strong, unique passwords for wallet encryption</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Info */}
      <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>
          Built with Next.js + TypeScript • Rust Backend • Industry Standards (BIP39/BIP44)
        </p>
        <p className="mt-1">
          Compatible with MetaMask, Ledger, and other standard wallets
        </p>
      </div>
    </div>
  );
}
