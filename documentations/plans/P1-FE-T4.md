# P1-W2-FE-T4: Create Wallet Creation/Import UI

## Context

Phase 1 crypto engine (mnemonic, encryption, HD wallets), storage layer (IndexedDB, session manager), and API client are all complete with 190 passing tests. The next step is building the UI to wire these together — wallet creation and import flows. Component directories exist but are empty.

## Sub-tasks Breakdown

| # | Sub-task | Files | Complexity |
|---|----------|-------|------------|
| 1 | Wallet name input component | `components/wallet/WalletNameInput.tsx` | Small |
| 2 | Password form component (reusable) | `components/wallet/PasswordForm.tsx` | Small |
| 3 | Mnemonic display grid | `components/wallet/MnemonicDisplay.tsx` | Small |
| 4 | Mnemonic backup confirmation | `components/wallet/MnemonicConfirm.tsx` | Medium |
| 5 | Validation helpers + tests | `components/wallet/validation.ts`, `__tests__/validation.test.ts` | Small |
| 6 | Wallet creation flow (orchestrator) | `components/wallet/CreateWalletFlow.tsx` | Medium |
| 7 | Wallet import flow | `components/wallet/ImportWalletFlow.tsx` | Medium |
| 8 | Wire up page.tsx | `app/page.tsx` (modify) | Small |

## User Flows

### Wallet Creation (4 steps)
1. **Name & Password** — wallet name (1-32 chars) + password (min 8 chars) + confirm
2. **Mnemonic Display** — calls `createWallet(name, password)`, shows 12 words in 3x4 grid, checkbox "I have written down my recovery phrase"
3. **Mnemonic Confirm** — pick 3 random word positions, user re-enters them
4. **Success** — confirmation message, clear mnemonic from state

### Wallet Import (2 steps)
1. **Name, Mnemonic & Password** — wallet name + textarea for mnemonic (with real-time `validateMnemonic()`) + password/confirm
2. **Success** — calls `importWallet()`, shows confirmation

## Implementation Plan

### Sub-task 1-2: WalletNameInput + PasswordForm
- Simple controlled inputs with Tailwind styling
- PasswordForm: show/hide toggle, match validation, min 8 chars
- Reused by both Create and Import flows

### Sub-task 3: MnemonicDisplay
- Props: `words: string[]`, `onConfirm: () => void`
- Numbered 3x4 grid, `user-select: none` CSS
- Security warning + checkbox gate before continuing
- **Security**: no console.log, no clipboard, discourage screenshots

### Sub-task 4: MnemonicConfirm
- Props: `words: string[]`, `onConfirm: () => void`, `onBack: () => void`
- Pick 3 random indices, show input fields for those positions
- Case-insensitive trimmed match

### Sub-task 5: Validation helpers
- Extract to `validation.ts`: `validateWalletName()`, `validatePassword()`, `pickRandomIndices()`, `verifyMnemonicWords()`
- Unit test each in `__tests__/validation.test.ts` (matches existing Vitest pattern)

### Sub-task 6: CreateWalletFlow
- Multi-step wizard with state: `step`, `walletName`, `password`, `mnemonic`, `walletId`
- Step 2 calls `createWallet()` from `walletService.ts`
- `useEffect` cleanup nulls mnemonic on unmount
- Props: `onComplete`, `onCancel`

### Sub-task 7: ImportWalletFlow
- Single form + success view
- Calls `validateMnemonic()` for real-time feedback, `importWallet()` on submit
- Props: `onComplete`, `onCancel`

### Sub-task 8: Wire up page.tsx
- Add `view` state: `'welcome' | 'create' | 'import'`
- Replace stub handlers: `handleCreateWallet → setView('create')`, `handleImportWallet → setView('import')`
- Render flow components conditionally

## Existing Code to Reuse

| Function | File |
|----------|------|
| `createWallet(name, password)` | `lib/storage/walletService.ts` |
| `importWallet(name, mnemonic, password)` | `lib/storage/walletService.ts` |
| `validateMnemonic(mnemonic)` | `lib/crypto/mnemonic.ts` |
| `useWallet()`, `useWalletLoading()`, `useWalletError()`, `useWalletActions()` | `lib/stores/walletStore.ts` |
| `CreateWalletForm`, `ImportWalletForm`, `WalletError` | `lib/types/wallet.ts` |

## Security

- Mnemonic lives in React state ONLY during creation steps 2-3; nulled on step 4 / cancel / unmount
- `user-select: none` on mnemonic grid
- No console.log of sensitive data
- `walletService` already handles encryption + secure seed cleanup

## Verification

1. `cd frontend && npm run build` — no type errors
2. `cd frontend && npm run test:run` — existing 190 tests still pass
3. `cd frontend && npx vitest run src/components/wallet/__tests__/` — new validation tests pass
4. `cd frontend && npm run dev` — manually test both Create and Import flows in browser
