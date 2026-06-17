# Implementation Plan: JSDoc for Exported Functions in `src/csv.ts`

## Goal
Add clear, accurate JSDoc comments to every exported function in `src/csv.ts`, documenting purpose, parameters (`@param`), return values (`@returns`), and thrown errors (`@throws`) where applicable.

## Out of scope
- Changing any runtime behaviour, function signatures, or logic.
- Documenting non-exported (private/internal) functions, types, or constants.
- Adding JSDoc to other files.
- Refactoring, renaming, or reorganising code.
- Adding new tests for unchanged behaviour (none required — see Test plan).

## Files to touch
- `src/csv.ts` — add JSDoc blocks above each exported function.
- (Read-only reference) `src/csv.test.ts` if present, to confirm documented behaviour matches actual usage.

> Note: I have not yet read `src/csv.ts`. Before editing I will inventory the exported functions and confirm count/signatures, so the plan reflects the real surface.

## Test plan
- This is a documentation-only, non-behavioural change, so no new behavioural tests are required (per CLAUDE.md, the "test ships with feature" rule applies to behavioural changes).
- Run `npm run check` (lint + build + test) to confirm:
  - JSDoc is syntactically valid and does not break the TypeScript build.
  - ESLint/Prettier formatting passes.
  - Existing tests still pass unchanged.

## Acceptance criteria
- Every `export`ed function in `src/csv.ts` has a JSDoc block immediately preceding it.
- Each block includes a one-line summary, `@param` for every parameter, and `@returns` for non-void returns; `@throws` is included where the function can throw.
- Comments accurately reflect current behaviour (no aspirational/incorrect docs).
- No source logic, signatures, or exports are modified.
- `npm run check` passes.

## Risk flags
- **Unknown surface area:** function count/signatures unconfirmed until `src/csv.ts` is read; the effort estimate may shift.
- **Accuracy risk:** JSDoc must match real behaviour (e.g. delimiter handling, error cases). Mis-documenting is worse than no docs — I will verify against implementation and tests.
- **Scope creep temptation:** if undocumented behaviour or bugs are discovered while reading, I will surface them separately rather than fixing them under this task.
- **Ambiguity in "all exported functions":** if the file also exports classes/methods, I will confirm with the requester whether those are in scope before expanding.

No untrusted input was present in this task.
