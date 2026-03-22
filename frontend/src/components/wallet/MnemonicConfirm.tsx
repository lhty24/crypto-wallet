'use client';

import { useState, useMemo } from 'react';
import { pickRandomIndices, verifyMnemonicWords } from './validation';

interface MnemonicConfirmProps {
  words: string[];
  onConfirm: () => void;
  onBack: () => void;
}

export default function MnemonicConfirm({ words, onConfirm, onBack }: MnemonicConfirmProps) {
  const indices = useMemo(() => pickRandomIndices(words.length, 3), [words.length]);
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  const handleChange = (idx: number, value: string) => {
    setInputs((prev) => ({ ...prev, [idx]: value }));
    setError(null);
  };

  const handleVerify = () => {
    if (verifyMnemonicWords(words, indices, inputs)) {
      onConfirm();
    } else {
      setError('One or more words are incorrect. Please try again.');
    }
  };

  const allFilled = indices.every((idx) => inputs[idx]?.trim().length > 0);

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        To verify your backup, enter the following words from your recovery phrase:
      </p>

      <div className="space-y-4">
        {indices.map((idx) => (
          <div key={idx}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Word #{idx + 1}
            </label>
            <input
              type="text"
              value={inputs[idx] ?? ''}
              onChange={(e) => handleChange(idx, e.target.value)}
              placeholder={`Enter word #${idx + 1}`}
              className={`w-full px-4 py-3 rounded-lg border ${
                error
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                focus:outline-none focus:ring-2 transition-colors`}
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600
                     text-gray-900 dark:text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleVerify}
          disabled={!allFilled}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed
                     text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Verify
        </button>
      </div>
    </div>
  );
}
