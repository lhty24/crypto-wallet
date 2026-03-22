'use client';

import { useState } from 'react';
import { validatePassword } from './validation';

interface PasswordFormProps {
  password: string;
  confirmPassword: string;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  error?: string | null;
}

export default function PasswordForm({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  error,
}: PasswordFormProps) {
  const [showPassword, setShowPassword] = useState(false);

  const validationError = error ?? (
    password.length > 0 && confirmPassword.length > 0
      ? validatePassword(password, confirmPassword)
      : null
  );

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="Min 8 characters"
            className={`w-full px-4 py-3 pr-12 rounded-lg border ${
              validationError
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
            } bg-white dark:bg-gray-700 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 transition-colors`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Confirm Password
        </label>
        <input
          id="confirm-password"
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value)}
          placeholder="Re-enter password"
          className={`w-full px-4 py-3 rounded-lg border ${
            validationError
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
          } bg-white dark:bg-gray-700 text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 transition-colors`}
        />
      </div>

      {validationError && <p className="text-sm text-red-500">{validationError}</p>}
    </div>
  );
}
