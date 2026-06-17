# Phase 0/1 Governance Review — Agentic SDLC Pilot

**Prepared for:** Governance council · **Status:** DRAFT for council review (US-047 — *not* signed off)
**Date:** 2026-06-17 · **Repo:** [carloshumbertoreyesortiz/agentic-sdlc-pilot](https://github.com/carloshumbertoreyesortiz/agentic-sdlc-pilot) · **Live dashboard:** https://carloshumbertoreyesortiz.github.io/agentic-sdlc-pilot/

> **Verification note.** Every figure and PR link below was read from live sources on 2026-06-17 — the GitHub Issues backlog, merged PRs (`gh pr list`), the auto-generated [DASHBOARD.md](../DASHBOARD.md) (refreshed immediately before writing), `git log`, and live API checks. Items that could not be verified from this environment are marked **TBD** with what is needed to confirm them.

---

## 1. Executive summary

The pilot platform was largely **built by the agentic loop itself, operating under its own governance**: as of 2026-06-17, **28 of 50 user stories are closed (56%; 77/159 story points, 48%)** across 28 merged pull requests, each carrying machine-written provenance and passing the project's own CI gates. Phase 1 (the plan-only agent loop) is **56% complete and functionally proven end-to-end** — a full *idea → plan → agent branch → provenance → reviewed PR → merge* cycle was demonstrated (the §13 smoke test, PR #86). On stakeholder demand the loop absorbed three live delivery-dashboard iterations (v1, v2, and an auto-refresh race fix) plus a published Pages site, none of which were in the original backlog. A **verify-first discipline surfaced and corrected at least four documentation/configuration defects** before they could mislead reviewers (including a token-expansion bug that made an MCP server *appear* connected while silently failing auth). Risk **R-03 is resolved**; **R-01 and R-02 are carried with documented exit triggers**. While compiling this report, the platform's verify-first discipline surfaced **R-04** — a previously-unnoticed gap in branch protection on `main`. All historical merges passed both gates, but the gates were advisory rather than enforced. The finding is intact and actionable; remediation is the first item proposed under §6.

---

## 2. Definition-of-done evidence (impl guide §13.2)

Status legend: ✅ verified · ⚠️ partial / needs manual confirmation · ❌ not in effect · ⛔ deferred to Phase 2.

| # | Capability (§13.2) | Status | Evidence (live check / PR) | Tracking |
|---|---|---|---|---|
| 1 | Claude Code installed & authenticated | ✅ | Live: `claude --version` → **2.1.126**; headless `claude -p` ran authenticated this session | [US-008](https://github.com/carloshumbertoreyesortiz/agentic-sdlc-pilot/issues/18) *(per-engineer install story still open)*; `claude doctor` **TBD** |
| 2 | VS Code with Claude Code extension | ⚠️ TBD | Cannot verify headlessly — need someone to confirm the side panel opens and `/plan` runs inside VS Code | [US-004](https://github.com/carloshumbertoreyesortiz/agentic-sdlc-pilot/issues/14) *(open)* |
| 3 | Anthropic API key working | ✅ | SDK planner made a real call → `artifacts/plan.md`, real token cost **1250/905** (`claude-opus-4-8`) | PR #66, PR #86 · [US-022](https://github.com/carloshumbertoreyesortiz/agentic-sdlc-pilot/issues/32) |
| 4 | GitHub repo with branch protection | ⚠️ **Passed historically, advisory now** | Both gates passed on every merge to date, but live check shows protection **not currently enforced**: `gh api …/branches/main/protection` → **`404 Branch not protected`**, **0 rulesets**. Tracked as **R-04** (§3) | PR #64 · [US-018](https://github.com/carloshumbertoreyesortiz/agentic-sdlc-pilot/issues/28) *(closed)* · see **R-04** |
| 5 | Custom slash command (`/plan`) | ✅ | `.claude/commands/plan.md` present; seed task drove `artifacts/plan.md` | PR #60, PR #65 · [US-016](https://github.com/carloshumbertoreyesortiz/agentic-sdlc-pilot/issues/26), [US-021](https://github.com/carloshumbertoreyesortiz/agentic-sdlc-pilot/issues/31) |
| 6 | Custom Node agent (planner) | ✅ | `scripts/agent-planner.ts`; real run prints token cost (1250/905) | PR #66 · [US-022](https://github.com/carloshumbertoreyesortiz/agentic-sdlc-pilot/issues/32) |
| 7 | MCP servers wired | ✅ | Live: `claude mcp list` → **filesystem ✓ Connected, github ✓ Connected**; adversarial PR-read + non-existent-file tests passed | PR #85 · [US-026](https://github.com/carloshumbertoreyesortiz/agentic-sdlc-pilot/issues/36)/[US-027](https://github.com/carloshumbertoreyesortiz/agentic-sdlc-pilot/issues/37)/[US-028](https://github.com/carloshumbertoreyesortiz/agentic-sdlc-pilot/issues/38) |
| 8 | Provenance Action blocks no-provenance PR | ✅ ⚠️ | Workflow + negative test proven; gate posted its verified comment on PR #86. **Caveat:** "required"/blocking enforcement is currently *advisory* because branch protection is off (row 4) | PR #59, #61, #62/#63 · [US-031](https://github.com/carloshumbertoreyesortiz/agentic-sdlc-pilot/issues/41), [US-032](https://github.com/carloshumbertoreyesortiz/agentic-sdlc-pilot/issues/42), [US-033](https://github.com/carloshumbertoreyesortiz/agentic-sdlc-pilot/issues/43) |
| 9 | Playwright baseline test | ⛔ Deferred | Not started — Browser Verification (E-08) deferred to Phase 2 per architecture | [E-08](https://github.com/carloshumbertoreyesortiz/agentic-sdlc-pilot/issues/8) *(open)* |

**Rollup (live dashboard):** Phase 0 — Foundation **5/15 (33%)** · Phase 1 — Plan-only pilot **23/31 (56%)** · Phase 2 **0/4 (0%)**. Phase 0's lower % reflects the **per-engineer workstation rollout** (E-01, 0/5) and runtime provisioning (E-02, 3/6) that are manual/in-progress; the platform *capabilities* those epics underpin are demonstrably working (rows 1, 3, 5–8).

---

## 3. Risk register state

Source: [docs/risks.md](risks.md) plus live verification on 2026-06-17.

| ID | Severity | Status | Owner | Exit trigger |
|---|---|---|---|---|
| **R-01** | Medium → **recommend High** | **Active — worse than recorded** | Solo operator (`carloshumbertoreyesortiz`) | Re-apply branch protection on `main` (required checks: `check`, `agent-provenance`) **and** set `enforce_admins=true` once a second collaborator exists |
| **R-02** | High | Active | `carloshumbertoreyesortiz` | Transfer repo into the `TelenorNorgeInternal` org (governance/SSO/audit). *Now also **public**, widening exposure.* |
| **R-03** | Low | **Resolved** (2026-06-11) | — | Closed: headless planner captures real `response.usage`; re-confirmed this session (`claude-opus-4-8`, 1250/905) |
| **R-04** | **High** | **Open** — surfaced for Phase 1 → Phase 2 review (US-047) | Carlos + governance council | Branch protection on `main` inactive (live: `404 Branch not protected`, 0 rulesets); historical merges passed both gates but enforcement is advisory. **Exit:** re-apply protection at Phase 2 kickoff — required checks (`check`, `agent-provenance`), 1 review, restrictions empty; `enforce_admins` decision carried from R-01 |

> **R-01 finding (new, this review):** the recorded risk was "`enforce_admins=false` (gate advisory for admins)". Live checks show **no classic branch protection and no rulesets at all** on `main` — i.e., the gate is currently advisory for *everyone*, not just admins. Cause is unconfirmed (**TBD** — plausibly dropped when the repo was made public, or never persisted on the prior private/free plan). **Recommendation:** re-apply protection immediately; treat R-01 as High until done. This does not undo the delivered work (every merge to date passed both gates), but it must be fixed before Phase 2.

---

## 4. Emergent work the loop absorbed (not originally planned)

Evidence that the loop handles scope that arrives mid-flight, and self-corrects under its own governance:

- **Delivery-dashboard suite** (created and delivered on demand, mostly new stories):
  - **US-045** — self-updating delivery dashboard (PR #70) *(was in backlog)*
  - **US-048** — KPI dashboard v2: epic timelines, ISO weeks, velocity, weekly activity (PR #72, #73) *(emergent)*
  - **US-049** — auto-refresh race fix: schedule/dispatch only (PR #75) *(emergent)*
  - **US-050** — published as a GitHub Pages site (PR #77), incl. auto-deploy (PR #82) and three contrast fixes (PR #78, #79, #80) *(emergent)*
- **Verify-first defect corrections** (≥4):
  1. **`.mcp.json` token expansion** — AC specified `${env:GH_AGENT_TOKEN}`, which does **not** expand in Claude Code; it produced a real `Authentication Failed: Bad credentials` that the "connected" status masked. Corrected to `${GH_AGENT_TOKEN}` (PR #85).
  2. **Weekly-activity footnote** — corrected the seeding-spike week from W22 to **W24** to match the data it annotates (PR #73).
  3. **`EPIC_DATES` provenance** — labelled the Gantt dates "estimates only" until milestones get real due dates, to avoid implying committed dates (PR #73).
  4. **Branch-protection finding** — this review (Section 3), surfaced by a live check rather than trusting the closed story.
- **Security catch:** a credential pasted into a working session was flagged for rotation rather than used.

---

## 5. Outstanding items into Phase 2

| Item | Blocker | Owner needed |
|---|---|---|
| **Slack intake bot (E-09)** — scaffold + 3 checkpoint builders done (PR #84); live bot not wired | **US-038** needs a registered Slack app + tokens | **Slack workspace admin** (contact **TBD**) |
| **Browser verification (E-08, Playwright)** | Deferred per architecture until Phase 1 proven | Squad (Phase 2) |
| **Repo transfer into Telenor org (R-02)** | Needs an org owner with repo-transfer rights | **Org admin** (**TBD**) |
| **Org Project board creation** | Same org-permission dependency | **Org admin** (**TBD**) |
| **Re-apply branch protection (R-01)** | None — repo owner can do immediately | `carloshumbertoreyesortiz` |

---

## 6. Asks for the council

Explicit decisions required to close US-047 and proceed:

- **(a) Phase 1 sign-off — yes / no.** Plan-only loop is functionally proven (§2 rows 3, 5–8; smoke test PR #86). Caveat to weigh: branch protection not currently in effect (§3).
- **(b) Phase 2 budget approval.** Amount **TBD** — needs Finance input on token spend + tooling for Coder/Browser subagents.
- **(c) Assign a second collaborator.** Unblocks re-applying branch protection with `enforce_admins=true` → **closes R-01**.
- **(d) Slack workspace admin contact** for **US-038**, to unblock the E-09 live bot.
- **(e) Approve immediate re-application of branch protection on `main`** as the **first action of Phase 2** → **closes R-04** (pending the `enforce_admins` decision under R-01). *(Held deliberately: not re-applied yet, so the finding's evidence stays visible for this review.)*
- **(recommended) Authorize repo transfer** into `TelenorNorgeInternal` → **closes R-02**.

---

*This document is generated as part of US-047 but does not close it. US-047 closes only after the governance council reviews and records a decision.*
