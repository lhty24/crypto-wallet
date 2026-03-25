'use client';

import { useState, useCallback } from 'react';
import { importWallet } from '@/lib/storage/walletService';
import { validateMnemonic } from '@/lib/crypto/mnemonic';
import { showSuccess, showError } from '@/lib/utils/toast';
import { validateWalletName, validatePassword } from './validation';
import WalletNameInput from './WalletNameInput';
import PasswordForm from './PasswordForm';

interface ImportWalletFlowProps {
  onComplete: () => void;
  onCancel: () => void;
}

export default function ImportWalletFlow({ onComplete, onCancel }: ImportWalletFlowProps) {
  const [walletName, setWalletName] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Real-time mnemonic validation feedback
  const trimmedMnemonic = mnemonic.trim().replace(/\s+/g, ' ');
  const isMnemonicValid = trimmedMnemonic.length > 0 && validateMnemonic(trimmedMnemonic);
  const showMnemonicHint = trimmedMnemonic.length > 0 && !isMnemonicValid;

  const handleSubmit = useCallback(async () => {
    const nameError = validateWalletName(walletName);
    if (nameError) { setError(nameError); return; }

    if (!isMnemonicValid) {
      setError('Invalid recovery phrase. Please check and try again.');
      return;
    }

    const pwError = validatePassword(password, confirmPassword);
    if (pwError) { setError(pwError); return; }

    setError(null);
    setIsImporting(true);

    try {
      await importWallet(walletName.trim(), trimmedMnemonic, password);
      setMnemonic('');
      setSuccess(true);
      showSuccess('Wallet imported successfully');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to import wallet';
      setError(msg);
      showError(msg);
    } finally {
      setIsImporting(false);
    }
  }, [walletName, isMnemonicValid, trimmedMnemonic, password, confirmPassword]);

  if (success) {
    return (
      <div className="max-w-md mx-auto text-center space-y-6">
        <div className="text-5xl">&#x2705;</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Wallet Imported</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Your wallet <span className="font-semibold">{walletName}</span> has been imported and encrypted.
          You can now unlock it with your password.
        </p>
        <button
          onClick={onComplete}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Import Wallet</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Enter your recovery phrase to restore an existing wallet.
        </p>
      </div>

      <WalletNameInput value={walletName} onChange={setWalletName} />

      <div>
        <label htmlFor="mnemonic" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Recovery Phrase
        </label>
        <textarea
          id="mnemonic"
          value={mnemonic}
          onChange={(e) => { setMnemonic(e.target.value); setError(null); }}
          placeholder="Enter your 12 or 24 word recovery phrase, separated by spaces"
          rows={3}
          className={`w-full px-4 py-3 rounded-lg border ${
            showMnemonicHint
              ? 'border-amber-500 focus:ring-amber-500'
              : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
          } bg-white dark:bg-gray-700 text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 transition-colors resize-none`}
        />
        {showMnemonicHint && (
          <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
            Invalid phrase. Must be 12 or 24 valid BIP39 words.
          </p>
        )}
      </div>

      <PasswordForm
        password={password}
        confirmPassword={confirmPassword}
        onPasswordChange={setPassword}
        onConfirmPasswordChange={setConfirmPassword}
      />

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
          disabled={isImporting}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                     text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {isImporting ? 'Importing...' : 'Import Wallet'}
        </button>
      </div>
    </div>
  );
}
