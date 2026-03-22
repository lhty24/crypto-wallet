'use client';

interface WalletNameInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}

export default function WalletNameInput({ value, onChange, error }: WalletNameInputProps) {
  return (
    <div>
      <label htmlFor="wallet-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Wallet Name
      </label>
      <input
        id="wallet-name"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="My Wallet"
        maxLength={32}
        className={`w-full px-4 py-3 rounded-lg border ${
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
        } bg-white dark:bg-gray-700 text-gray-900 dark:text-white
          focus:outline-none focus:ring-2 transition-colors`}
      />
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}
