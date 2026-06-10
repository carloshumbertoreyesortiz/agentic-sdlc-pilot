# Branching convention

> Story: **US-019** — Document and enforce the `agent/*` branch naming convention
> Epic: **E-04** — Git Foundation & Branch Protection
> Companion: IMPL-AGENTIC-SDLC-001 §05.2 (Hard rules), ARCH-AGENTIC-SDLC-001 §06

## Rule (hard)

`main` is protected. **No one — human or agent — pushes directly to `main`.**
All changes land through a pull request that passes required checks and human review.

Every branch created by an agent **MUST** be prefixed with `agent/`:

```
agent/<ticket-or-slug>
```

Examples:

```
agent/us-021-csv-escape-fix
agent/us-019-branch-convention
agent/e07-provenance-workflow
```

Human-authored branches follow the team's normal convention (e.g. `feature/*`,
`fix/*`) and are out of scope for the agentic gates below.

## Why the prefix matters

The `agent/` prefix is the signal the automation keys off:

- **Provenance gate (E-07):** the `agent-provenance` GitHub Action runs on
  `pull_request` events where `head_ref` starts with `agent/`. It fails the PR
  if `.agent/provenance.json` is missing or invalid.
- **Branch protection (US-018):** `main` requires 1 approving review, dismisses
  stale reviews on push, and requires the `check` and `agent-provenance` status
  checks before merge.
- **Auditability:** every agent contribution is attributable to a branch whose
  name encodes the originating ticket.

## Responsibilities

- **The `/plan` command (US-016):** plans it produces must name the working
  branch as `agent/<ticket>` so the downstream coder agent uses the right prefix.
- **Custom agent scripts (E-05):** must create and push to `agent/*` branches
  only; they must never target `main` directly.
- **Reviewers:** confirm the branch is `agent/*` and that the provenance check is
  green before approving.

## Lifecycle

1. Agent (or `/plan`) creates `agent/<ticket>` off the latest `main`.
2. Agent commits its work **and** writes `.agent/provenance.json` before the
   final commit (US-030).
3. Agent opens a PR into `main`.
4. CI (`check`) and the provenance gate (`agent-provenance`) run.
5. A human reviews and approves; the PR merges; the branch is deleted.

## Phase 0/1 exception: `enforce_admins=false`

While the repo is solo-operated, branch protection runs with
`enforce_admins=false`. Admin can bypass required checks (demonstrated
2026-06-10, PR #62/#63: an agent/* PR with no provenance failed the
`agent-provenance` check, but the owner bypass merged it; it was reverted).

- **Exit trigger:** flip to `enforce_admins=true` when a second collaborator
  is added (so the 1-review gate is satisfiable by a real reviewer).
- **Revisit:** at the E-10 governance review (US-047).
