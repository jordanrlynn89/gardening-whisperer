Review the PR for this branch. Follow these steps:

1. Get the PR diff: `gh pr diff`
2. Get PR details: `gh pr view`
3. Check CI status: `gh pr checks`

Review for:
- Correctness: logic errors, edge cases, off-by-one errors
- Security: no secrets in code, no XSS/injection risks
- Tests: new functionality has tests, existing tests not broken
- Voice UX: responses stay conversational and short
- Gemini integration: JSON structure matches expected schema
- TypeScript: no `any` types, proper null checks

Provide a summary with:
- What the PR does (1-2 sentences)
- Issues found (categorized by severity: blocker / warning / nit)
- Suggested improvements
