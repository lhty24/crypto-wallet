'use client';

import { useState, useEffect, useCallback } from 'react';
import { createWallet } from '@/lib/storage/walletService';
import { validateWalletName, validatePassword } from './validation';
import WalletNameInput from './WalletNameInput';
import PasswordForm from './PasswordForm';
import MnemonicDisplay from './MnemonicDisplay';
import MnemonicConfirm from './MnemonicConfirm';

interface CreateWalletFlowProps {
  onComplete: () => void;
  onCancel: () => void;
}

type Step = 'name-password' | 'mnemonic-display' | 'mnemonic-confirm' | 'success';

export default function CreateWalletFlow({ onComplete, onCancel }: CreateWalletFlowProps) {
  const [step, setStep] = useState<Step>('name-password');
  const [walletName, setWalletName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Clear mnemonic from memory on unmount
  useEffect(() => {
    return () => { setMnemonic(null); };
  }, []);

  const words = mnemonic ? mnemonic.split(' ') : [];

  const handleNamePasswordSubmit = useCallback(async () => {
    const nameError = validateWalletName(walletName);
    if (nameError) { setError(nameError); return; }

    const pwError = validatePassword(password, confirmPassword);
    if (pwError) { setError(pwError); return; }

    setError(null);
    setIsCreating(true);

    try {
      const result = await createWallet(walletName.trim(), password);
      setMnemonic(result.mnemonic);
      setStep('mnemonic-display');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create wallet');
    } finally {
      setIsCreating(false);
    }
  }, [walletName, password, confirmPassword]);

  const handleMnemonicConfirmed = useCallback(() => {
    setStep('mnemonic-confirm');
  }, []);

  const handleBackupVerified = useCallback(() => {
    setMnemonic(null);
    setStep('success');
  }, []);

  const handleBackToDisplay = useCallback(() => {
    setStep('mnemonic-display');
  }, []);

  if (step === 'name-password') {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Wallet</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Choose a name and set a password to encrypt your wallet.
          </p>
        </div>

        <WalletNameInput value={walletName} onChange={setWalletName} />

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
            onClick={handleNamePasswordSubmit}
            disabled={isCreating}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                       text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {isCreating ? 'Creating...' : 'Continue'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'mnemonic-display' && words.length > 0) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Recovery Phrase</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Write down these {words.length} words in order. You will need them to recover your wallet.
          </p>
        </div>
        <MnemonicDisplay words={words} onConfirm={handleMnemonicConfirmed} />
      </div>
    );
  }

  if (step === 'mnemonic-confirm' && words.length > 0) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Verify Backup</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Confirm you have saved your recovery phrase correctly.
          </p>
        </div>
        <MnemonicConfirm words={words} onConfirm={handleBackupVerified} onBack={handleBackToDisplay} />
      </div>
    );
  }

  // Success step
  return (
    <div className="max-w-md mx-auto text-center space-y-6">
      <div className="text-5xl">&#x2705;</div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Wallet Created</h2>
      <p className="text-gray-600 dark:text-gray-400">
        Your wallet <span className="font-semibold">{walletName}</span> has been created and encrypted.
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
