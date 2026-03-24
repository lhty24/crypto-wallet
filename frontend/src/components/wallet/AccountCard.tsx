'use client';

import { useState } from 'react';
import type { Chain } from '@/lib/types/wallet';

interface AccountCardProps {
  chain: Chain;
  address: string;
  derivationPath: string;
  formattedBalance?: string;
}

export default function AccountCard({ chain, address, derivationPath, formattedBalance }: AccountCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-900 dark:text-white">{chain}</h3>
        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{derivationPath}</span>
      </div>
      <div className="mb-2">
        <span className="text-lg font-bold text-gray-900 dark:text-white">
          {formattedBalance ?? 'Loading...'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-sm text-gray-700 dark:text-gray-300 font-mono break-all">
          {address}
        </code>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
