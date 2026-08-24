# Testing Patterns

**Analysis Date:** 2026-08-24

## Current State: No Automated Testing Exists

This section is intentionally blunt because there is nothing to soften: this codebase has **no test framework, no test script, and no test files**. Verified directly:

- `package.json` has no `test` script (`scripts` block: `dev`, `build`, `start`, `lint` only) and no test dependency of any kind (no `jest`, `vitest`, `@testing-library/*`, `playwright`, `cypress`, `mocha`, `vitest`, etc. in `dependencies` or `devDependencies`).
- No test runner config files exist anywhere in the repo: no `jest.config.*`, `vitest.config.*`, `playwright.config.*`, `cypress.config.*`.
- No test files exist: `find . -name "*.test.*" -o -name "*.spec.*"` (excluding `node_modules`) returns zero results.
- `.gitignore` has a leftover `/coverage` entry from the `create-next-app` boilerplate (line under `# testing`), but nothing ever generates a coverage report — no coverage tool is installed.
- `node_modules` contains no Playwright, Jest, Vitest, or Testing Library packages.

**Do not assume any test coverage exists when planning a phase.** If a plan references "existing tests" for this project, that reference is wrong — verify against this document first.

## How Verification Actually Happens Today

Verification of behavior (e.g. checkout flow, payment success/failure paths, admin panel interactions) has been done ad hoc: Playwright scripts written directly to `/tmp` and run by hand during development sessions, then discarded. **These scripts are not committed to the repo, are not repeatable, and leave no artifact for future reference.** There is no record of what was checked, when, or whether it still passes against the current code. Treat any past manual verification as unverifiable and re-check behavior directly when planning changes to checkout, payment, or admin flows.

## What It Would Take to Close This Gap

If a phase's goal includes establishing real test coverage, the minimum path is:

1. **Pick and install a framework.** Given this is Next.js 16 + React 19 with the App Router, `route.ts` handlers, and `"use client"` components, reasonable choices:
   - **Vitest** for unit-level logic that doesn't need a DOM or browser: `lib/menu.ts` (`getMenuItem`), `lib/orders-store.ts` (`saveOrder`, `getOrders`, `updateOrderStatus` — note these hit `localStorage`, so they need a DOM shim like `jsdom` or `happy-dom`), the validation logic embedded in `app/api/charge/route.ts` and `app/api/reclamaciones/route.ts`.
   - **Playwright** (installed as a real devDependency and committed under e.g. `e2e/` or `tests/`) to formalize what's currently done ad hoc in `/tmp` — checkout happy path, payment rejection path, delivery vs pickup validation, admin Basic Auth gate (`proxy.ts`).
2. **Add a `test` script to `package.json`** so `npm test` (or `npm run test`) actually runs something — currently there is no command a contributor or CI step could even invoke.
3. **Decide a location convention** before writing tests, since none exists yet: co-located `*.test.ts` next to source, or a top-level `__tests__`/`e2e` directory. Either is greenfield — there's no existing pattern to match.
4. **Prioritize by risk given the codebase's own documented traps** (see `CONVENTIONS.md` Comments section): the server-side total recomputation in `app/api/charge/route.ts` (the exact bug it was written to prevent — client-supplied price — is the highest-value thing to regression-test), the Culqi `settings` payload shape (adding an extra key silently breaks rendering with no error), and the idempotency handling for duplicate charge submissions (Postgres `23505` branch).
5. **Environment/config for testing route handlers:** `app/api/charge/route.ts` and `app/api/reclamaciones/route.ts` both call `getSupabaseAdmin()` (`lib/supabase.ts`), which throws if `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are unset, and `app/api/charge/route.ts` also calls the live Culqi API. Any real test suite needs to mock `@supabase/supabase-js`'s `createClient` and the `fetch` call to `https://api.culqi.com/v2/charges` — there is currently no seam (interface/adapter) built for this; `getSupabaseAdmin` returns a concrete `SupabaseClient` and the Culqi call is an inline `fetch`, so mocking would currently mean mocking the module or global `fetch` directly.

## Test Framework

**Runner:** Not installed. Not applicable.

**Assertion Library:** Not installed. Not applicable.

**Run Commands:**
```bash
# No test command exists.
npm run lint    # the only quality-check script currently available
```

## Test File Organization

Not applicable — no test files exist to establish a pattern.

## Test Structure

Not applicable.

## Mocking

Not applicable. No mocking library or pattern exists in the repo.

## Fixtures and Factories

Not applicable — though note `app/admin/page.tsx:32-48` contains a `generateMockOrder()` function with `MOCK_NAMES`/`MOCK_ITEMS` arrays. This is a **runtime demo-data generator wired into the admin UI** (used to seed fake orders into `localStorage` for demoing the panel), not a test fixture, and should not be mistaken for one if a future test suite is built.

## Coverage

**Requirements:** None enforced — no coverage tool installed, no CI gate.

## Test Types

**Unit Tests:** None.

**Integration Tests:** None.

**E2E Tests:** None committed. Ad hoc, uncommitted Playwright scripts have been used manually against `/tmp` during development but leave no repo artifact — see "How Verification Actually Happens Today" above.

## Common Patterns

Not applicable — there is no existing async testing, error testing, or any other test pattern in this codebase to document. Any patterns introduced here would be establishing new convention, not following one.

---

*Testing analysis: 2026-08-24*
