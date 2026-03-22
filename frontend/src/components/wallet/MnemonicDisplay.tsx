'use client';

import { useState } from 'react';

interface MnemonicDisplayProps {
  words: string[];
  onConfirm: () => void;
}

export default function MnemonicDisplay({ words, onConfirm }: MnemonicDisplayProps) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
          Write these words down in order. Do not screenshot or store digitally. This is the only time they will be shown.
        </p>
      </div>

      {/* Mnemonic word grid — selection disabled to discourage copying */}
      <div
        className="grid grid-cols-3 gap-3 select-none"
        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        {words.map((word, index) => (
          <div
            key={index}
            className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2"
          >
            <span className="text-xs text-gray-400 dark:text-gray-500 w-5 text-right">
              {index + 1}.
            </span>
            <span className="text-sm font-mono text-gray-900 dark:text-white">
              {word}
            </span>
          </div>
        ))}
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          I have written down my recovery phrase and stored it in a safe place
        </span>
      </label>

      <button
        onClick={onConfirm}
        disabled={!confirmed}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed
                   text-white font-semibold py-3 px-6 rounded-lg transition-colors"
      >
        Continue
      </button>
    </div>
  );
}
