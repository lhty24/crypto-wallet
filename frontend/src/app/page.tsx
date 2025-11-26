/**
 * Welcome page for the crypto wallet application
 * 
 * This is the main entry point where users can:
 * - Create a new wallet
 * - Import an existing wallet
 * - Learn about wallet security
 * 
 * Web3 Learning Note: Wallet onboarding is crucial for user adoption.
 * The first experience sets the tone for security awareness and ease of use.
 */

'use client';

import { useState } from 'react';

export default function WalletWelcome() {
  const [isLoading, setIsLoading] = useState(false);

  // These will be connected to actual wallet creation functions in future tasks
  const handleCreateWallet = async () => {
    setIsLoading(true);
    // TODO: Implement wallet creation in next task
    console.log('Creating new wallet...');
    setTimeout(() => setIsLoading(false), 2000);
  };

  const handleImportWallet = async () => {
    setIsLoading(true);
    // TODO: Implement wallet import in next task
    console.log('Importing existing wallet...');
    setTimeout(() => setIsLoading(false), 2000);
  };

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
          onClick={handleCreateWallet}
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 
                     text-white font-semibold py-4 px-6 rounded-lg 
                     transition-colors duration-200 flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating...
            </>
          ) : (
            <>
              <span className="mr-2">✨</span>
              Create New Wallet
            </>
          )}
        </button>

        <button
          onClick={handleImportWallet}
          disabled={isLoading}
          className="w-full bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50
                     dark:bg-gray-700 dark:hover:bg-gray-600 dark:disabled:bg-gray-800
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
