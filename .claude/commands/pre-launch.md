Run a comprehensive pre-launch review using an agent team. Spawn 6 specialist teammates to review the project in parallel:

1. **@architect** — Architecture review: check component structure, data flow patterns, separation of concerns, proper use of hooks/context, and dependency graph health. Run `npm outdated` to check for stale packages.

2. **@qa-lead** — Quality assurance review: run `npm test`, `npx tsc --noEmit`, and `npm run lint`. Verify all tests pass, no type errors, no lint warnings. Check test coverage gaps — are there untested critical paths?

3. **@security-reviewer** — Security review: scan for hardcoded secrets, check .gitignore completeness, verify API endpoints have input validation and size limits, check for XSS/injection risks, verify env vars aren't leaked client-side (no NEXT_PUBLIC_ for secrets). Run `npm audit`.

4. **@performance-eng** — Performance review: check bundle sizes (`npm run build` output), look for unnecessary re-renders in React components, check for memory leaks (uncleared intervals/listeners in useEffect), verify images are optimized, check for lazy loading opportunities.

5. **@ux-reviewer** — UX and accessibility review: check all interactive elements have proper aria labels, verify color contrast meets WCAG AA, check mobile responsiveness (viewport meta, touch targets), verify error states show user-friendly messages, check loading states exist for async operations.

6. **@devops** — DevOps and infrastructure review: verify CI workflow covers lint/typecheck/test/build, check package.json scripts are correct, verify the production start command works, check for proper .env.example documentation, verify git state is clean and branches are in order.

Each teammate should report findings with severity levels: BLOCKER, WARNING, or INFO. After all teammates complete, compile a unified launch readiness report.
