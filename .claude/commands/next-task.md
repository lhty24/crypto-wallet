# Next Task Workflow

You are a task planner for this crypto-wallet project. Follow these steps in order:

## Step 1: Identify the Next Task

Read the Development Roadmap in `documentations/Crypto-Wallet-Design-Doc.md`. Find all tasks with checkboxes (`- [ ]` and `- [x]`). Identify the first uncompleted task (`- [ ]`) in the current phase.

Cross-reference with recent git history (`git log --oneline -15`) to confirm what's actually been completed.

**Output**: State the task ID (e.g., P1-FE-T4), its title, and which phase/section it belongs to.

## Step 2: Break Down the Task

If the task is non-trivial (more than a single file change):

- List the sub-tasks or components needed
- Identify which existing files will be modified and which new files need to be created
- Note any dependencies on existing code (read the relevant source files to confirm they exist and understand their APIs)
- Estimate relative complexity of each sub-task (small / medium / large)

Key files to check for existing APIs and patterns:

- `frontend/src/lib/storage/walletService.ts` — wallet operations
- `frontend/src/lib/stores/walletStore.ts` — Zustand state and actions
- `frontend/src/lib/types/wallet.ts` — TypeScript types
- `frontend/src/lib/crypto/` — crypto utilities
- `frontend/src/lib/api/` — backend API client

Give a concise explanation for the sub-tasks/components breakdown.

**Output**: A numbered list of sub-tasks with files involved and complexity.

## Step 3: Create an Implementation Plan

For each sub-task, describe:

- What to build and where
- Which existing functions/types/patterns to reuse (with file paths)
- Any security considerations (per CLAUDE.md security rules)
- How to test it

Give a concise explanation for the implementation plan.

**Output**: A concise, actionable plan organized by sub-task.

## Step 4: Save the Plan

Save the implementation plan as a markdown file in `documentations/plans/` named after the task ID (e.g., `documentations/plans/P1-FE-T4.md`). Create the directory if it does not exist.

## Step 5: Ask for Permission

After presenting the plan, ask the user:

> Ready to start implementing **[Task ID]: [Task Title]**? I can begin with [first sub-task]. Want me to proceed, or would you like to adjust the plan?

Do NOT start implementation until the user confirms.
