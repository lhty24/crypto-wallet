---
name: ship
description: Add comments to changed code, stage all changes, commit with a conventional message, push, and create a PR to main. Use when you're done with a session and want to ship your work.
argument-hint: "[optional commit message override]"
disable-model-invocation: true
allowed-tools: Bash, Read, Edit, Glob, Grep
---

# Ship: Comment, Commit, Push & PR

Ship all work from this session — add comments, commit, push, and open a PR to `main`.

## Step 1: Review and Comment Changed Code

1. Run `git diff` and `git diff --cached` to see all modified files
2. Run `git ls-files --others --exclude-standard` to see untracked files
3. Read each changed/new file
4. Add brief clarifying comments ONLY where the logic is not self-evident. Do NOT over-comment — skip obvious code. Follow the project's existing comment style.
5. For TypeScript/React files: use `//` comments. For Rust files: use `//` comments.

## Step 2: Safety Check

Before staging, scan for sensitive files that should NEVER be committed:
- `.env`, `.env.*` files
- Private keys, seed phrases, mnemonics
- `credentials.json`, `secrets.*`, `*.pem`, `*.key`

If any are found, **STOP and warn the user**. Do NOT proceed until they confirm.

## Step 3: Stage All Changes

Run `git add .` to stage everything.

Then run `git status` to show the user what will be committed.

## Step 4: Commit

Analyze the staged diff (`git diff --cached`) and create a commit message:

- Use conventional commit format: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`, etc.
- First line: concise summary under 72 characters
- If the changes are substantial, add a blank line followed by bullet points explaining the key changes
- Check if the changes implement (partially or fully) a task from the Development Roadmap in `documentations/Crypto-Wallet-Design-Doc.md`. If so, include the task label in the first line (e.g., `feat(P1-FE-T4): create wallet creation UI`). If the changes are not related to a roadmap task, omit the label.
- End with: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

If the user provided `$ARGUMENTS`, use that as the commit message instead of auto-generating one (still append the Co-Authored-By).

Create the commit using a HEREDOC format:
```
git commit -m "$(cat <<'EOF'
<commit message here>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

## Step 5: Push and Create PR

1. Get the current branch name: `git branch --show-current`
2. If on `main` or `master`, **STOP and warn the user** — they should be on a feature branch
3. Push to remote: `git push -u origin <branch-name>`
4. Create a PR targeting `main` using:

```
gh pr create --title "<short PR title>" --body "$(cat <<'EOF'
## Summary
<bullet points summarizing the changes>

## Test plan
<how to verify the changes work>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

5. Display the PR URL to the user

## Important Rules

- NEVER commit sensitive data (keys, mnemonics, passwords, .env files)
- NEVER force push
- NEVER push directly to main/master
- If any step fails, stop and report the error — do not continue blindly
