#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# Telenor — Agentic SDLC pilot: GitHub backlog seeder (Rev 1.2)
# Doc:  BACKLOG-AGENTIC-SDLC-001 Rev 1.0 · Author: Carlos Reyes
# Companion to: IMPL-AGENTIC-SDLC-001 Rev 1.2, ARCH-AGENTIC-SDLC-001 Rev 1.5
#
# Creates 10 epics, 47 user stories, 17 labels, 3 milestones.
# Optionally adds every issue to a GitHub Projects (v2) board.
# Idempotent for labels/milestones; issues will duplicate on re-run.
#
# Runs on stock macOS bash 3.2 (no associative arrays, no here-doc
# inside command substitution) as well as bash 4+/5+.
#
# Usage:
#   ./create-issues.sh <owner/repo> [--project NUMBER --project-owner ORG]
#
# Examples (no project board):
#   ./create-issues.sh TelenorNorgeInternal/agentic-sdlc-pilot
#
# Examples (also add to org project 408):
#   ./create-issues.sh TelenorNorgeInternal/agentic-sdlc-pilot \
#     --project 408 --project-owner TelenorNorgeInternal
#
# Prerequisites:
#   - gh CLI 2.40+ installed
#   - gh authenticated with project scope:
#       gh auth refresh -s project,write:org,repo
#   - Repo exists and you have write access
#   - For --project: write access to that org's Projects v2 board
# ──────────────────────────────────────────────────────────────────

set -euo pipefail

REPO=""
PROJECT_NUM=""
PROJECT_OWNER=""

# ── arg parsing ────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    --project)        PROJECT_NUM="$2"; shift 2 ;;
    --project-owner)  PROJECT_OWNER="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,29p' "$0"; exit 0 ;;
    *)
      if [ -z "$REPO" ]; then REPO="$1"; shift
      else echo "Unknown arg: $1"; exit 1; fi ;;
  esac
done

if [ -z "$REPO" ]; then
  echo "Usage: $0 <owner/repo> [--project NUMBER --project-owner ORG]"
  echo "Example: $0 TelenorNorgeInternal/agentic-sdlc-pilot --project 408 --project-owner TelenorNorgeInternal"
  exit 1
fi

ADD_TO_PROJECT=false
if [ -n "$PROJECT_NUM" ] && [ -n "$PROJECT_OWNER" ]; then
  ADD_TO_PROJECT=true
fi

echo "→ Target repo:    $REPO"
if $ADD_TO_PROJECT; then
  echo "→ Project board:  https://github.com/orgs/$PROJECT_OWNER/projects/$PROJECT_NUM"
fi
echo "→ Verifying gh CLI auth ..."
gh auth status >/dev/null 2>&1 || { echo "FAIL: gh not authenticated. Run \`gh auth login\`."; exit 1; }
gh repo view "$REPO" >/dev/null 2>&1 || { echo "FAIL: cannot access $REPO. Check spelling and permissions."; exit 1; }
if $ADD_TO_PROJECT; then
  gh project view "$PROJECT_NUM" --owner "$PROJECT_OWNER" >/dev/null 2>&1 || {
    echo "FAIL: cannot access project $PROJECT_OWNER/projects/$PROJECT_NUM."
    echo "      Possible fix: gh auth refresh -s project,write:org"
    exit 1
  }
fi

# ── epic issue numbers, filled in as epics are created ──────────────
# (plain vars, not an associative array, so this runs on bash 3.2)
EPIC_E01=""; EPIC_E02=""; EPIC_E03=""; EPIC_E04=""; EPIC_E05=""
EPIC_E06=""; EPIC_E07=""; EPIC_E08=""; EPIC_E09=""; EPIC_E10=""

# Result of the most recent create_issue call.
LAST_ISSUE_URL=""

# helper — add an issue URL to the project board (no-op if not configured)
add_to_project() {
  local issue_url="$1"
  if $ADD_TO_PROJECT; then
    gh project item-add "$PROJECT_NUM" --owner "$PROJECT_OWNER" --url "$issue_url" >/dev/null 2>&1 \
      || echo "    WARN: failed to add $issue_url to project"
  fi
}

# helper — create an issue. Body is read from stdin (a here-doc at the
# call site), so no here-doc ever sits inside a $(...) — the construct
# that bash 3.2 mis-parses when the body contains apostrophes.
#   create_issue <title> <labels> <milestone>   <<'BODY' ... BODY
# Placeholders resolved in the body:
#   __REPO__       → the target owner/repo
#   __EPIC_Exx__   → the issue number of epic E-xx
# Sets LAST_ISSUE_URL and adds the issue to the project board.
create_issue() {
  local title="$1" labels="$2" milestone="$3" body prio_label prio_text
  body=$(cat)
  body=${body//__REPO__/$REPO}
  body=${body//__EPIC_E01__/$EPIC_E01}
  body=${body//__EPIC_E02__/$EPIC_E02}
  body=${body//__EPIC_E03__/$EPIC_E03}
  body=${body//__EPIC_E04__/$EPIC_E04}
  body=${body//__EPIC_E05__/$EPIC_E05}
  body=${body//__EPIC_E06__/$EPIC_E06}
  body=${body//__EPIC_E07__/$EPIC_E07}
  body=${body//__EPIC_E08__/$EPIC_E08}
  body=${body//__EPIC_E09__/$EPIC_E09}
  body=${body//__EPIC_E10__/$EPIC_E10}
  # Derive priority from the issue's phase label. P0 is reserved for
  # production incidents and is never assigned here:
  #   phase:0 -> P1 (High) · phase:1 -> P2 (Medium) · phase:2 -> P3 (Low)
  case ",$labels," in
    *,phase:0,*) prio_label='priority:P1'; prio_text='P1 (High)' ;;
    *,phase:2,*) prio_label='priority:P3'; prio_text='P3 (Low)' ;;
    *)           prio_label='priority:P2'; prio_text='P2 (Medium)' ;;
  esac
  # Add a **Priority:** line right after the first **Phase:** (epics) or
  # **Effort:** (stories) metadata line, and tag the matching label.
  if ! printf '%s' "$body" | grep -q '^\*\*Priority:\*\*'; then
    body=$(printf '%s\n' "$body" | awk -v p="**Priority:** $prio_text — _derived from phase; re-triage as needed_" '
      { print }
      (!done && ($0 ~ /^\*\*Effort:\*\*/ || $0 ~ /^\*\*Phase:\*\*/)) { print p; done=1 }
    ')
  fi
  labels="$labels,$prio_label"
  LAST_ISSUE_URL=$(gh issue create -R "$REPO" \
    --title "$title" --label "$labels" --milestone "$milestone" --body "$body")
  add_to_project "$LAST_ISSUE_URL"
}

echo ""
echo "→ Creating labels (idempotent) ..."
gh label create 'epic' --color '5319E7' --description 'Epic (parent issue spanning multiple stories)' -R "$REPO" 2>/dev/null || echo "  (skip: epic exists)"
gh label create 'story' --color '0E8A16' --description 'User story' -R "$REPO" 2>/dev/null || echo "  (skip: story exists)"
gh label create 'phase:0' --color '1D76DB' --description 'Phase 0 — Foundation' -R "$REPO" 2>/dev/null || echo "  (skip: phase:0 exists)"
gh label create 'phase:1' --color '0E8A16' --description 'Phase 1 — Plan-only pilot' -R "$REPO" 2>/dev/null || echo "  (skip: phase:1 exists)"
gh label create 'phase:2' --color 'FBCA04' --description 'Phase 2 — Full agentic SDLC' -R "$REPO" 2>/dev/null || echo "  (skip: phase:2 exists)"
gh label create 'area:workstation' --color 'C5DEF5' --description 'Mac, VS Code, base tooling' -R "$REPO" 2>/dev/null || echo "  (skip: area:workstation exists)"
gh label create 'area:agent-runtime' --color 'C5DEF5' --description 'Claude Code, Antigravity, SDK' -R "$REPO" 2>/dev/null || echo "  (skip: area:agent-runtime exists)"
gh label create 'area:scaffold' --color 'C5DEF5' --description 'Repo scaffold, CLAUDE.md, .claude/' -R "$REPO" 2>/dev/null || echo "  (skip: area:scaffold exists)"
gh label create 'area:git' --color 'C5DEF5' --description 'Git, GitHub, branch protection' -R "$REPO" 2>/dev/null || echo "  (skip: area:git exists)"
gh label create 'area:mcp' --color 'C5DEF5' --description 'MCP servers, integrations' -R "$REPO" 2>/dev/null || echo "  (skip: area:mcp exists)"
gh label create 'area:provenance' --color 'C5DEF5' --description 'Provenance attestation, GitHub Actions' -R "$REPO" 2>/dev/null || echo "  (skip: area:provenance exists)"
gh label create 'area:browser' --color 'C5DEF5' --description 'Playwright, browser agent' -R "$REPO" 2>/dev/null || echo "  (skip: area:browser exists)"
gh label create 'area:intake' --color 'C5DEF5' --description 'Slack/Teams bot, multimodal intake' -R "$REPO" 2>/dev/null || echo "  (skip: area:intake exists)"
gh label create 'area:pilot' --color 'C5DEF5' --description 'Smoke test, pilot squad rollout' -R "$REPO" 2>/dev/null || echo "  (skip: area:pilot exists)"
gh label create 'effort:S' --color 'C2E0C6' --description '1–2 story points (≤ half day)' -R "$REPO" 2>/dev/null || echo "  (skip: effort:S exists)"
gh label create 'effort:M' --color 'FEF2C0' --description '3–5 story points (1–3 days)' -R "$REPO" 2>/dev/null || echo "  (skip: effort:M exists)"
gh label create 'effort:L' --color 'F9D0C4' --description '8–13 story points (1–2 weeks)' -R "$REPO" 2>/dev/null || echo "  (skip: effort:L exists)"
gh label create 'priority:P0' --color 'B60205' --description 'P0 — critical / blocker' -R "$REPO" 2>/dev/null || echo "  (skip: priority:P0 exists)"
gh label create 'priority:P1' --color 'D93F0B' --description 'P1 — high' -R "$REPO" 2>/dev/null || echo "  (skip: priority:P1 exists)"
gh label create 'priority:P2' --color 'FBCA04' --description 'P2 — medium (default / untriaged)' -R "$REPO" 2>/dev/null || echo "  (skip: priority:P2 exists)"
gh label create 'priority:P3' --color '0E8A16' --description 'P3 — low / nice-to-have' -R "$REPO" 2>/dev/null || echo "  (skip: priority:P3 exists)"

echo ""
echo "→ Creating milestones (idempotent) ..."
gh api -X POST "repos/$REPO/milestones" -f title='Phase 0 — Foundation' -f description='Tenant, workstation, agent runtime, Git setup. Per architecture §08.' -f state=open >/dev/null 2>&1 || echo "  (skip: 'Phase 0 — Foundation' exists)"
gh api -X POST "repos/$REPO/milestones" -f title='Phase 1 — Plan-only pilot' -f description='Planner Agent live, multimodal intake, three checkpoints, pilot squad onboarded.' -f state=open >/dev/null 2>&1 || echo "  (skip: 'Phase 1 — Plan-only pilot' exists)"
gh api -X POST "repos/$REPO/milestones" -f title='Phase 2 — Full agentic SDLC' -f description='Coder + Browser subagents, deploy gating, hardening.' -f state=open >/dev/null 2>&1 || echo "  (skip: 'Phase 2 — Full agentic SDLC' exists)"

echo ""
echo "→ Creating epics ..."

create_issue '[EPIC] E-01: Engineer Workstation Foundation' \
  'epic,phase:0,area:workstation' \
  'Phase 0 — Foundation' <<'BODY'
## Epic E-01

Every engineer in the pilot squad needs a working Mac with Homebrew, Git, Node, Python, gh CLI, and VS Code with the right extensions. This epic is the prerequisite for everything else — without consistent workstations, agent runs are not reproducible.

**Phase:** 0 · **Stories:** 5 · **Points:** 7
**Impl guide:** §01, §02
**Companion:** IMPL-AGENTIC-SDLC-001 Rev 1.2, ARCH-AGENTIC-SDLC-001 Rev 1.5

### Acceptance criteria
- [ ] Each pilot squad engineer's Mac has Homebrew, git ≥2.47, node 22 LTS, python 3.12, gh 2.x.
- [ ] VS Code is installed with the Claude Code extension and the agreed shared extension set.
- [ ] Git identity and SSH key configured for each engineer.
- [ ] Workstation setup documented in the team wiki (≤30 min onboarding for new joiner).

### Stories in this epic
- [ ] US-001 — Install Homebrew on engineer Macs (2 pts)
- [ ] US-002 — Install core dev tools (git, node, python, gh, jq) (2 pts)
- [ ] US-003 — Configure Git identity and SSH key for GitHub (1 pts)
- [ ] US-004 — Install VS Code with Telenor extension set (1 pts)
- [ ] US-005 — Apply shared VS Code user settings (1 pts)
BODY
EPIC_E01=${LAST_ISSUE_URL##*/}
echo "  created E-01 as issue #$EPIC_E01"

create_issue '[EPIC] E-02: Agent Runtime Provisioning' \
  'epic,phase:0,area:agent-runtime' \
  'Phase 0 — Foundation' <<'BODY'
## Epic E-02

Stand up the two agentic runtimes (Claude Code from Anthropic, optionally Antigravity 2.0 from Google) on engineer workstations, with subscriptions and API keys provisioned. Both are GA today per architecture Rev 1.5.

**Phase:** 0 · **Stories:** 6 · **Points:** 11
**Impl guide:** §03, §04, §04B
**Companion:** IMPL-AGENTIC-SDLC-001 Rev 1.2, ARCH-AGENTIC-SDLC-001 Rev 1.5

### Acceptance criteria
- [ ] Each pilot engineer has either a Claude Pro/Max/Team/Enterprise subscription OR a Console API account on Telenor billing.
- [ ] Claude Code is installed and authenticated; `claude doctor` returns all green.
- [ ] ANTHROPIC_API_KEY stored securely (Keychain or direnv, never plaintext in shell config).
- [ ] (Optional) Antigravity 2.0 desktop + agy CLI installed and `agy --version` works.
- [ ] curl smoke test against api.anthropic.com returns 200.

### Stories in this epic
- [ ] US-006 — Provision Anthropic Console accounts on Telenor billing (3 pts)
- [ ] US-007 — Verify each engineer's Claude subscription tier (1 pts)
- [ ] US-008 — Install Claude Code on engineer workstations (2 pts)
- [ ] US-009 — (Optional) Install Antigravity 2.0 desktop + agy CLI (3 pts)
- [ ] US-010 — Secure ANTHROPIC_API_KEY in macOS Keychain (1 pts)
- [ ] US-011 — Validate both runtimes with smoke tests (1 pts)
BODY
EPIC_E02=${LAST_ISSUE_URL##*/}
echo "  created E-02 as issue #$EPIC_E02"

create_issue '[EPIC] E-03: Pilot Repository Scaffold' \
  'epic,phase:1,area:scaffold' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Epic E-03

Create the agentic-sdlc-pilot GitHub repo with all the conventions the architecture requires: CLAUDE.md, .claude/ commands, .agent/ provenance folder, .gitignore with secrets exclusions, npm scripts, TypeScript baseline.

**Phase:** 1 · **Stories:** 5 · **Points:** 10
**Impl guide:** §05
**Companion:** IMPL-AGENTIC-SDLC-001 Rev 1.2, ARCH-AGENTIC-SDLC-001 Rev 1.5

### Acceptance criteria
- [ ] Repo __REPO__ exists under Telenor GitHub org.
- [ ] CLAUDE.md authored and reviewed by squad lead.
- [ ] Custom /plan slash command runs against a seed task and produces artifacts/plan.md.
- [ ] npm run check (lint + build + test) passes on initial scaffold.

### Stories in this epic
- [ ] US-012 — Create agentic-sdlc-pilot GitHub repo under Telenor org (1 pts)
- [ ] US-013 — Author CLAUDE.md per Telenor conventions (3 pts)
- [ ] US-014 — Configure .gitignore with secrets exclusions (1 pts)
- [ ] US-015 — Initialize package.json with npm scripts (2 pts)
- [ ] US-016 — Author /plan custom slash command in .claude/commands/ (3 pts)
BODY
EPIC_E03=${LAST_ISSUE_URL##*/}
echo "  created E-03 as issue #$EPIC_E03"

create_issue '[EPIC] E-04: Git Foundation & Branch Protection' \
  'epic,phase:0,area:git' \
  'Phase 0 — Foundation' <<'BODY'
## Epic E-04

Lock down `main` so agents cannot push to it. Define the agent/* branch convention. Create a fine-grained PAT for the agent's GitHub identity (distinct from any engineer's personal credentials).

**Phase:** 0 · **Stories:** 4 · **Points:** 9
**Impl guide:** §06
**Companion:** IMPL-AGENTIC-SDLC-001 Rev 1.2, ARCH-AGENTIC-SDLC-001 Rev 1.5

### Acceptance criteria
- [ ] Branch protection rule on `main` requires PR review and status checks.
- [ ] Agents commit to `agent/*` branches only; direct pushes to main blocked for all (including admins, unless emergency).
- [ ] GH_AGENT_TOKEN created as a fine-grained PAT scoped to the pilot repo with minimal permissions.
- [ ] PAT documented in the secrets-management runbook with rotation cadence.

### Stories in this epic
- [ ] US-017 — Authenticate gh CLI for the pilot squad (2 pts)
- [ ] US-018 — Configure branch protection on main (3 pts)
- [ ] US-019 — Document and enforce agent/* branch naming convention (1 pts)
- [ ] US-020 — Create fine-grained GH_AGENT_TOKEN for MCP (3 pts)
BODY
EPIC_E04=${LAST_ISSUE_URL##*/}
echo "  created E-04 as issue #$EPIC_E04"

create_issue '[EPIC] E-05: First Planner Agent Loop' \
  'epic,phase:1,area:agent-runtime' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Epic E-05

Drive a real end-to-end plan-only cycle against a seed task — both interactively via Claude Code and headlessly via the Anthropic SDK. This is the first time the architecture's Checkpoint 1 (plan approval) becomes a lived experience for the squad.

**Phase:** 1 · **Stories:** 4 · **Points:** 24
**Impl guide:** §07, §09
**Companion:** IMPL-AGENTIC-SDLC-001 Rev 1.2, ARCH-AGENTIC-SDLC-001 Rev 1.5

### Acceptance criteria
- [ ] Claude Code /plan command produces artifacts/plan.md for a seed task.
- [ ] Headless TypeScript script reproduces the same plan output, with token cost logged.
- [ ] Untrusted-input tagging implemented in both interactive and headless flows.
- [ ] Three pilot tuning cycles complete, with squad feedback captured.

### Stories in this epic
- [ ] US-021 — Drive first end-to-end /plan run against the CSV-escape seed task (5 pts)
- [ ] US-022 — Build headless planner script via Anthropic SDK (8 pts)
- [ ] US-023 — Implement untrusted-input tagging in planner system prompt (3 pts)
- [ ] US-024 — Run 3 pilot tuning cycles and capture metrics (8 pts)
BODY
EPIC_E05=${LAST_ISSUE_URL##*/}
echo "  created E-05 as issue #$EPIC_E05"

create_issue '[EPIC] E-06: MCP Server Ecosystem' \
  'epic,phase:1,area:mcp' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Epic E-06

Wire the agent into external tools via MCP servers. Start with filesystem (sandboxed file access) and GitHub (PR operations). Adds Playwright later in E-08 if needed.

**Phase:** 1 · **Stories:** 4 · **Points:** 7
**Impl guide:** §08
**Companion:** IMPL-AGENTIC-SDLC-001 Rev 1.2, ARCH-AGENTIC-SDLC-001 Rev 1.5

### Acceptance criteria
- [ ] Filesystem and GitHub MCP servers installed and listed in `/mcp list`.
- [ ] Agent successfully invokes GitHub MCP tools (list PRs, comment on issue) from inside the REPL.
- [ ] .claude/mcp.json is project-scoped (not global) so secrets stay in the right scope.

### Stories in this epic
- [ ] US-025 — Install filesystem MCP server (1 pts)
- [ ] US-026 — Install GitHub MCP server with fine-grained PAT (3 pts)
- [ ] US-027 — Configure project-scoped .claude/mcp.json (2 pts)
- [ ] US-028 — Verify MCP integration end-to-end (1 pts)
BODY
EPIC_E06=${LAST_ISSUE_URL##*/}
echo "  created E-06 as issue #$EPIC_E06"

create_issue '[EPIC] E-07: Provenance & Compliance Workflow' \
  'epic,phase:1,area:provenance' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Epic E-07

Implement the architecture's provenance requirement: every agent-authored PR carries a .agent/provenance.json file recording model, prompts, tool trace, attachment hashes, human approver, and cost. The GitHub Action enforces it as a required status check.

**Phase:** 1 · **Stories:** 5 · **Points:** 17
**Impl guide:** §10
**Companion:** IMPL-AGENTIC-SDLC-001 Rev 1.2, ARCH-AGENTIC-SDLC-001 Rev 1.5

### Acceptance criteria
- [ ] Provenance JSON schema documented and reviewed.
- [ ] Custom agent (E-05) writes provenance.json before its final commit.
- [ ] GitHub Action runs on every PR from agent/* branches and fails the check if provenance is missing or invalid.
- [ ] Branch protection blocks merge when provenance check is red.

### Stories in this epic
- [ ] US-029 — Design .agent/provenance.json schema (3 pts)
- [ ] US-030 — Implement provenance writer in custom agent (5 pts)
- [ ] US-031 — Build GitHub Actions agent-provenance workflow (5 pts)
- [ ] US-032 — Wire agent-provenance as required status check on main (2 pts)
- [ ] US-033 — Validate by attempting a no-provenance merge (negative test) (2 pts)
BODY
EPIC_E07=${LAST_ISSUE_URL##*/}
echo "  created E-07 as issue #$EPIC_E07"

create_issue '[EPIC] E-08: Browser Verification (Playwright)' \
  'epic,phase:2,area:browser' \
  'Phase 2 — Full agentic SDLC' <<'BODY'
## Epic E-08

Build the Browser Subagent equivalent locally using Playwright. The agent can run a real Chromium instance, execute user journeys, take screenshots, and run visual diffs. This unlocks Phase 2 (Coder + Browser agents).

**Phase:** 2 · **Stories:** 4 · **Points:** 11
**Impl guide:** §11
**Companion:** IMPL-AGENTIC-SDLC-001 Rev 1.2, ARCH-AGENTIC-SDLC-001 Rev 1.5

### Acceptance criteria
- [ ] Playwright installed in pilot repo with Chromium and dependencies.
- [ ] Baseline visual regression test captures and compares screenshots with 1% tolerance.
- [ ] Custom agent (E-05) can invoke Playwright as a tool and act on pass/fail results.
- [ ] (Optional) Playwright MCP server installed for use inside Claude Code REPL.

### Stories in this epic
- [ ] US-034 — Install Playwright + Chromium (1 pts)
- [ ] US-035 — Author baseline visual regression test (3 pts)
- [ ] US-036 — Build run-visual tool for the agent loop (5 pts)
- [ ] US-037 — (Optional) Install Playwright MCP server (2 pts)
BODY
EPIC_E08=${LAST_ISSUE_URL##*/}
echo "  created E-08 as issue #$EPIC_E08"

create_issue '[EPIC] E-09: Slack Intake Bot' \
  'epic,phase:1,area:intake' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Epic E-09

Build the Slack-based human-loop surface (per architecture Rev 1.5: Slack and Teams are interchangeable peers; pilot starts with Slack for lower friction). Implements multimodal intake and the three checkpoint approval flows.

**Phase:** 1 · **Stories:** 6 · **Points:** 34
**Impl guide:** §12
**Companion:** IMPL-AGENTIC-SDLC-001 Rev 1.2, ARCH-AGENTIC-SDLC-001 Rev 1.5

### Acceptance criteria
- [ ] Slack app registered in Telenor workspace with required scopes.
- [ ] Bot ingests @-mentions with attachments and URLs, normalising into IntakeBundle schema.
- [ ] All three checkpoints (plan approval, PR review, deploy approval) implemented as Block Kit interactive messages.
- [ ] Pilot squad can drive a real agent run end-to-end via Slack only.

### Stories in this epic
- [ ] US-038 — Register Slack app in Telenor workspace with required scopes (3 pts)
- [ ] US-039 — Build bot scaffold with read-only first run (5 pts)
- [ ] US-040 — Implement intake handler with attachment hashing (8 pts)
- [ ] US-041 — Implement Checkpoint 1 (plan approval) Block Kit flow (8 pts)
- [ ] US-042 — Implement Checkpoint 2 (PR review) DM flow (5 pts)
- [ ] US-043 — Implement Checkpoint 3 (deploy approval) flow (5 pts)
BODY
EPIC_E09=${LAST_ISSUE_URL##*/}
echo "  created E-09 as issue #$EPIC_E09"

create_issue '[EPIC] E-10: Phase 0/1 Smoke Test & Pilot Launch' \
  'epic,phase:1,area:pilot' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Epic E-10

The final gate that says Phase 0 + Phase 1 are done. Drive a full end-to-end run, set up the metrics dashboard, run a 2-week pilot with one squad, and review with the governance council.

**Phase:** 1 · **Stories:** 4 · **Points:** 24
**Impl guide:** §13
**Companion:** IMPL-AGENTIC-SDLC-001 Rev 1.2, ARCH-AGENTIC-SDLC-001 Rev 1.5

### Acceptance criteria
- [ ] Smoke test from §13.1 passes — all 8 checklist items green.
- [ ] Metrics dashboard live with the 6 baseline metrics.
- [ ] 2-week pilot completed; defect/cost/satisfaction data captured.
- [ ] Governance council sign-off recorded; decision on Phase 2 made.

### Stories in this epic
- [ ] US-044 — Run end-to-end smoke test per impl guide §13 (3 pts)
- [ ] US-045 — Stand up metrics dashboard with 6 baseline metrics (5 pts)
- [ ] US-046 — Run 2-week pilot with one squad, collect feedback (13 pts)
- [ ] US-047 — Governance council Phase 0/1 sign-off review (3 pts)
BODY
EPIC_E10=${LAST_ISSUE_URL##*/}
echo "  created E-10 as issue #$EPIC_E10"


echo ""
echo "→ Creating user stories ..."

create_issue '[STORY] US-001: Install Homebrew on engineer Macs' \
  'story,phase:0,area:workstation,effort:S' \
  'Phase 0 — Foundation' <<'BODY'
## Story US-001

**Parent epic:** E-01 — Engineer Workstation Foundation
**Effort:** S (2 pts)
**Impl guide:** §01.2
**Depends on:** —

### User story
As a pilot squad engineer, I want Homebrew installed on my Mac, so that I can manage development tooling consistently.

### Acceptance criteria
- [ ] `brew --version` returns Homebrew 4.x
- [ ] PATH updated in ~/.zprofile (Apple Silicon: /opt/homebrew; Intel: /usr/local)
- [ ] Persists across terminal restarts


_Parent epic: #__EPIC_E01___
BODY
echo "  created US-001: $LAST_ISSUE_URL"

create_issue '[STORY] US-002: Install core dev tools (git, node, python, gh, jq)' \
  'story,phase:0,area:workstation,effort:S' \
  'Phase 0 — Foundation' <<'BODY'
## Story US-002

**Parent epic:** E-01 — Engineer Workstation Foundation
**Effort:** S (2 pts)
**Impl guide:** §01.3
**Depends on:** US-001

### User story
As an engineer, I want the core CLI tooling installed via Homebrew, so that I can run the impl-guide commands without missing dependencies.

### Acceptance criteria
- [ ] git ≥ 2.47, node 22 LTS, python 3.12, gh 2.x, jq installed
- [ ] All commands available on PATH in a fresh terminal
- [ ] Optional: httpie, tree, direnv also installed


_Parent epic: #__EPIC_E01___
BODY
echo "  created US-002: $LAST_ISSUE_URL"

create_issue '[STORY] US-003: Configure Git identity and SSH key for GitHub' \
  'story,phase:0,area:workstation,effort:S' \
  'Phase 0 — Foundation' <<'BODY'
## Story US-003

**Parent epic:** E-01 — Engineer Workstation Foundation
**Effort:** S (1 pts)
**Impl guide:** §01.4, §06.1, §06.2
**Depends on:** US-002

### User story
As an engineer, I want my Git identity and SSH key configured, so that commits are attributable and I can push to the pilot repo.

### Acceptance criteria
- [ ] `git config --global user.email` returns Telenor email
- [ ] ed25519 SSH key generated at ~/.ssh/id_ed25519_github
- [ ] Key added to GitHub account, `ssh -T git@github.com` succeeds


_Parent epic: #__EPIC_E01___
BODY
echo "  created US-003: $LAST_ISSUE_URL"

create_issue '[STORY] US-004: Install VS Code with Telenor extension set' \
  'story,phase:0,area:workstation,effort:S' \
  'Phase 0 — Foundation' <<'BODY'
## Story US-004

**Parent epic:** E-01 — Engineer Workstation Foundation
**Effort:** S (1 pts)
**Impl guide:** §02.1, §02.2
**Depends on:** US-001

### User story
As an engineer, I want VS Code installed with the agreed extensions, so that my editor environment matches the rest of the squad.

### Acceptance criteria
- [ ] VS Code installed via `brew install --cask visual-studio-code`
- [ ] Claude Code extension installed
- [ ] ESLint, Prettier, editorconfig, GitHub Actions, Playwright extensions installed
- [ ] `code` CLI shim on PATH


_Parent epic: #__EPIC_E01___
BODY
echo "  created US-004: $LAST_ISSUE_URL"

create_issue '[STORY] US-005: Apply shared VS Code user settings' \
  'story,phase:0,area:workstation,effort:S' \
  'Phase 0 — Foundation' <<'BODY'
## Story US-005

**Parent epic:** E-01 — Engineer Workstation Foundation
**Effort:** S (1 pts)
**Impl guide:** §02.3
**Depends on:** US-004

### User story
As an engineer, I want shared user settings applied, so that format-on-save and the Claude Code plan-first defaults match the squad's conventions.

### Acceptance criteria
- [ ] settings.json includes format-on-save, eslint fix-on-save, claude-code.planFirst: true, claude-code.defaultModel pinned
- [ ] Settings reviewed and accepted by squad


_Parent epic: #__EPIC_E01___
BODY
echo "  created US-005: $LAST_ISSUE_URL"

create_issue '[STORY] US-006: Provision Anthropic Console accounts on Telenor billing' \
  'story,phase:0,area:agent-runtime,effort:M' \
  'Phase 0 — Foundation' <<'BODY'
## Story US-006

**Parent epic:** E-02 — Agent Runtime Provisioning
**Effort:** M (3 pts)
**Impl guide:** §03.2
**Depends on:** —

### User story
As the squad lead, I want Anthropic Console accounts provisioned on Telenor's corporate billing, so that API usage is tracked and chargebacks land in the right cost centre.

### Acceptance criteria
- [ ] Telenor corporate card or invoicing arrangement set up at console.anthropic.com
- [ ] Initial spend limit set per Finance guidance
- [ ] Token budget alert thresholds configured (50%, 80%, 100%)


_Parent epic: #__EPIC_E02___
BODY
echo "  created US-006: $LAST_ISSUE_URL"

create_issue "[STORY] US-007: Verify each engineer's Claude subscription tier" \
  'story,phase:0,area:agent-runtime,effort:S' \
  'Phase 0 — Foundation' <<'BODY'
## Story US-007

**Parent epic:** E-02 — Agent Runtime Provisioning
**Effort:** S (1 pts)
**Impl guide:** §03.1
**Depends on:** —

### User story
As an engineer, I want to confirm I am on a paid Claude tier, so that Claude Code interactive use doesn't fall back to API-token billing.

### Acceptance criteria
- [ ] Each engineer confirms Pro, Max, Team, or Enterprise plan at claude.ai/settings
- [ ] Plan tier documented per-engineer for the squad lead


_Parent epic: #__EPIC_E02___
BODY
echo "  created US-007: $LAST_ISSUE_URL"

create_issue '[STORY] US-008: Install Claude Code on engineer workstations' \
  'story,phase:0,area:agent-runtime,effort:S' \
  'Phase 0 — Foundation' <<'BODY'
## Story US-008

**Parent epic:** E-02 — Agent Runtime Provisioning
**Effort:** S (2 pts)
**Impl guide:** §04.1, §04.4, §04.5
**Depends on:** US-001, US-002, US-007

### User story
As an engineer, I want Claude Code installed via the official installer, so that I can run the agentic CLI alongside VS Code.

### Acceptance criteria
- [ ] `claude --version` returns 2.x
- [ ] `claude doctor` returns all green
- [ ] Browser OAuth completed against Telenor email
- [ ] First REPL run responds in <3 seconds


_Parent epic: #__EPIC_E02___
BODY
echo "  created US-008: $LAST_ISSUE_URL"

create_issue '[STORY] US-009: (Optional) Install Antigravity 2.0 desktop + agy CLI' \
  'story,phase:0,area:agent-runtime,effort:M' \
  'Phase 0 — Foundation' <<'BODY'
## Story US-009

**Parent epic:** E-02 — Agent Runtime Provisioning
**Effort:** M (3 pts)
**Impl guide:** §04B
**Depends on:** US-001

### User story
As an engineer evaluating peer runtimes, I want Antigravity 2.0 installed alongside Claude Code, so that I can compare Gemini-backed agent runs against Claude-backed runs.

### Acceptance criteria
- [ ] `brew install --cask antigravity` succeeds (or DMG installed manually)
- [ ] `agy --version` returns 2.0.x
- [ ] Google OAuth completed against Telenor Google account
- [ ] Test prompt returns a response


_Parent epic: #__EPIC_E02___
BODY
echo "  created US-009: $LAST_ISSUE_URL"

create_issue '[STORY] US-010: Secure ANTHROPIC_API_KEY in macOS Keychain' \
  'story,phase:0,area:agent-runtime,effort:S' \
  'Phase 0 — Foundation' <<'BODY'
## Story US-010

**Parent epic:** E-02 — Agent Runtime Provisioning
**Effort:** S (1 pts)
**Impl guide:** §03.3
**Depends on:** US-006

### User story
As an engineer, I want the API key stored in Keychain (not plaintext shell config), so that an attacker reading my ~/.zshrc does not also get my API credentials.

### Acceptance criteria
- [ ] Key stored via `security add-generic-password`
- [ ] Shell config retrieves at runtime via `security find-generic-password`
- [ ] Key NOT visible in plaintext anywhere in dotfiles or shell history


_Parent epic: #__EPIC_E02___
BODY
echo "  created US-010: $LAST_ISSUE_URL"

create_issue '[STORY] US-011: Validate both runtimes with smoke tests' \
  'story,phase:0,area:agent-runtime,effort:S' \
  'Phase 0 — Foundation' <<'BODY'
## Story US-011

**Parent epic:** E-02 — Agent Runtime Provisioning
**Effort:** S (1 pts)
**Impl guide:** §03.4, §04.6
**Depends on:** US-008, US-010

### User story
As the squad lead, I want each engineer's workstation validated end-to-end before they touch the pilot repo, so that broken setups don't surface during real work.

### Acceptance criteria
- [ ] curl smoke test against api.anthropic.com returns 200 with valid response
- [ ] claude REPL responds inside <3 seconds
- [ ] (If Antigravity installed) agy responds inside <3 seconds
- [ ] Squad lead signs off per-engineer


_Parent epic: #__EPIC_E02___
BODY
echo "  created US-011: $LAST_ISSUE_URL"

create_issue '[STORY] US-012: Create agentic-sdlc-pilot GitHub repo under Telenor org' \
  'story,phase:1,area:scaffold,effort:S' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-012

**Parent epic:** E-03 — Pilot Repository Scaffold
**Effort:** S (1 pts)
**Impl guide:** §06.4
**Depends on:** US-003

### User story
As the squad lead, I want the pilot repo created under the Telenor org, so that the work is tracked in our enterprise tenant and inherits org-wide audit settings.

### Acceptance criteria
- [ ] Repo created as `__REPO__` (private)
- [ ] Default branch `main`
- [ ] License set per Telenor open-source policy (or proprietary)
- [ ] README placeholder committed


_Parent epic: #__EPIC_E03___
BODY
echo "  created US-012: $LAST_ISSUE_URL"

create_issue '[STORY] US-013: Author CLAUDE.md per Telenor conventions' \
  'story,phase:1,area:scaffold,effort:M' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-013

**Parent epic:** E-03 — Pilot Repository Scaffold
**Effort:** M (3 pts)
**Impl guide:** §05.2
**Depends on:** US-012

### User story
As an engineer, I want a thorough CLAUDE.md in the repo root, so that the agent has a clear contract — what the project is, what conventions apply, what is off-limits.

### Acceptance criteria
- [ ] CLAUDE.md covers Purpose, Tech stack, Conventions, Hard rules, Commands, Plan-first mode, Untrusted inputs (per §05.2)
- [ ] Hard rules include: no secrets, no main pushes, tests with feature code
- [ ] Reviewed and approved by squad lead before first agent run


_Parent epic: #__EPIC_E03___
BODY
echo "  created US-013: $LAST_ISSUE_URL"

create_issue '[STORY] US-014: Configure .gitignore with secrets exclusions' \
  'story,phase:1,area:scaffold,effort:S' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-014

**Parent epic:** E-03 — Pilot Repository Scaffold
**Effort:** S (1 pts)
**Impl guide:** §05.4
**Depends on:** US-012

### User story
As an engineer, I want a hardened .gitignore, so that .env files and credentials never enter Git history by accident.

### Acceptance criteria
- [ ] .env, .envrc, .env.*, *.pem, *.key excluded
- [ ] node_modules, dist, coverage, *.log excluded
- [ ] .DS_Store and .vscode/settings.json excluded
- [ ] artifacts/run-* and .agent/cache/ excluded


_Parent epic: #__EPIC_E03___
BODY
echo "  created US-014: $LAST_ISSUE_URL"

create_issue '[STORY] US-015: Initialize package.json with npm scripts' \
  'story,phase:1,area:scaffold,effort:S' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-015

**Parent epic:** E-03 — Pilot Repository Scaffold
**Effort:** S (2 pts)
**Impl guide:** §05.5
**Depends on:** US-012, US-002

### User story
As an engineer, I want package.json with the lint/build/test/check scripts, so that the agent (and CI) can execute the standard verification commands.

### Acceptance criteria
- [ ] npm scripts: build (tsc), test (vitest), lint (eslint), format (prettier), check (lint + build + test), dev (tsx watch)
- [ ] tsconfig.json initialised
- [ ] vitest, eslint, prettier dev-deps installed


_Parent epic: #__EPIC_E03___
BODY
echo "  created US-015: $LAST_ISSUE_URL"

create_issue '[STORY] US-016: Author /plan custom slash command in .claude/commands/' \
  'story,phase:1,area:scaffold,effort:M' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-016

**Parent epic:** E-03 — Pilot Repository Scaffold
**Effort:** M (3 pts)
**Impl guide:** §05.3
**Depends on:** US-013

### User story
As an engineer, I want the /plan slash command defined in .claude/commands/plan.md, so that any plan-mode agent run produces the same structured artifact.

### Acceptance criteria
- [ ] File exists with description, argument-hint, and instructions per §05.3
- [ ] Plan template requires: Goal, Out of scope, Files to touch, Test plan, Acceptance criteria, Risk flags
- [ ] Slash command stops before any edit and waits for human approval


_Parent epic: #__EPIC_E03___
BODY
echo "  created US-016: $LAST_ISSUE_URL"

create_issue '[STORY] US-017: Authenticate gh CLI for the pilot squad' \
  'story,phase:0,area:git,effort:S' \
  'Phase 0 — Foundation' <<'BODY'
## Story US-017

**Parent epic:** E-04 — Git Foundation & Branch Protection
**Effort:** S (2 pts)
**Impl guide:** §06.3
**Depends on:** US-003

### User story
As an engineer, I want gh CLI authenticated to GitHub via SSH, so that I can open PRs, create branches and run repo operations from the terminal.

### Acceptance criteria
- [ ] `gh auth status` shows logged-in via SSH
- [ ] `gh repo view __REPO__` succeeds
- [ ] Documented for new joiners


_Parent epic: #__EPIC_E04___
BODY
echo "  created US-017: $LAST_ISSUE_URL"

create_issue '[STORY] US-018: Configure branch protection on main' \
  'story,phase:0,area:git,effort:M' \
  'Phase 0 — Foundation' <<'BODY'
## Story US-018

**Parent epic:** E-04 — Git Foundation & Branch Protection
**Effort:** M (3 pts)
**Impl guide:** §06.5
**Depends on:** US-012, US-017

### User story
As the squad lead, I want branch protection on main, so that agents physically cannot push to it and every PR requires human review.

### Acceptance criteria
- [ ] 1 approving review required, stale-review-dismissed on push
- [ ] Required status checks: `check` (CI) and `agent-provenance` (from E-07)
- [ ] enforce_admins=false (so leads can hotfix), restrictions empty
- [ ] Verified via `gh api .../branches/main/protection`


_Parent epic: #__EPIC_E04___
BODY
echo "  created US-018: $LAST_ISSUE_URL"

create_issue '[STORY] US-019: Document and enforce agent/* branch naming convention' \
  'story,phase:0,area:git,effort:S' \
  'Phase 0 — Foundation' <<'BODY'
## Story US-019

**Parent epic:** E-04 — Git Foundation & Branch Protection
**Effort:** S (1 pts)
**Impl guide:** §05.2 Hard rules
**Depends on:** US-013

### User story
As the squad lead, I want agent branches to always be prefixed with `agent/`, so that the GitHub Action and provenance workflow can identify them and gate accordingly.

### Acceptance criteria
- [ ] Convention documented in CLAUDE.md and the team wiki
- [ ] Slash command /plan writes plans referring to `agent/<ticket>` branches
- [ ] Custom agent scripts use the prefix


_Parent epic: #__EPIC_E04___
BODY
echo "  created US-019: $LAST_ISSUE_URL"

create_issue '[STORY] US-020: Create fine-grained GH_AGENT_TOKEN for MCP' \
  'story,phase:0,area:git,effort:M' \
  'Phase 0 — Foundation' <<'BODY'
## Story US-020

**Parent epic:** E-04 — Git Foundation & Branch Protection
**Effort:** M (3 pts)
**Impl guide:** §08.4
**Depends on:** US-018

### User story
As an engineer, I want a fine-grained GitHub PAT scoped only to the pilot repo, so that the agent's GitHub identity is distinct from my personal credentials and revocable in seconds.

### Acceptance criteria
- [ ] PAT created at github.com/settings/personal-access-tokens/new
- [ ] Scope: only __REPO__
- [ ] Permissions: Contents R/W, Pull requests R/W, Metadata R, Workflows R/W
- [ ] Expiration: 90 days; rotation cadence in runbook
- [ ] Stored in .envrc, not committed


_Parent epic: #__EPIC_E04___
BODY
echo "  created US-020: $LAST_ISSUE_URL"

create_issue '[STORY] US-021: Drive first end-to-end /plan run against the CSV-escape seed task' \
  'story,phase:1,area:agent-runtime,effort:M' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-021

**Parent epic:** E-05 — First Planner Agent Loop
**Effort:** M (5 pts)
**Impl guide:** §07.1–07.5
**Depends on:** US-016, US-008

### User story
As an engineer, I want to run the /plan slash command end-to-end against the seed task (RFC 4180 CSV escaping fix), so that the squad observes the human checkpoint firing for real.

### Acceptance criteria
- [ ] Plan written to artifacts/plan.md
- [ ] Agent stops and waits for approval (no source edits before approval)
- [ ] Approved plan results in commits on agent/csv-escape-fix branch
- [ ] `npm run check` passes after agent run


_Parent epic: #__EPIC_E05___
BODY
echo "  created US-021: $LAST_ISSUE_URL"

create_issue '[STORY] US-022: Build headless planner script via Anthropic SDK' \
  'story,phase:1,area:agent-runtime,effort:L' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-022

**Parent epic:** E-05 — First Planner Agent Loop
**Effort:** L (8 pts)
**Impl guide:** §09.2, §09.3
**Depends on:** US-013, US-015

### User story
As an engineer, I want a scripts/agent-planner.ts that calls Claude headlessly, so that planning can run from CI or scheduled jobs without an interactive REPL.

### Acceptance criteria
- [ ] @anthropic-ai/sdk installed
- [ ] Script reads CLAUDE.md + task arg, writes artifacts/plan.md
- [ ] Token usage logged (input/output)
- [ ] Exit code non-zero on failure
- [ ] Documented in repo README


_Parent epic: #__EPIC_E05___
BODY
echo "  created US-022: $LAST_ISSUE_URL"

create_issue '[STORY] US-023: Implement untrusted-input tagging in planner system prompt' \
  'story,phase:1,area:agent-runtime,effort:M' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-023

**Parent epic:** E-05 — First Planner Agent Loop
**Effort:** M (3 pts)
**Impl guide:** §09.2 (SYSTEM_PROMPT), arch §06 risk register
**Depends on:** US-022

### User story
As a security-conscious engineer, I want all attachment content and fetched URLs wrapped in `<untrusted_input>` tags, so that prompt-injection via screenshots and links is mitigated.

### Acceptance criteria
- [ ] System prompt explicitly frames untrusted content as data not instructions
- [ ] Attachment content wrapped in tagged frames before being added to messages array
- [ ] Tested with adversarial sample (screenshot containing prompt-injection text)


_Parent epic: #__EPIC_E05___
BODY
echo "  created US-023: $LAST_ISSUE_URL"

create_issue '[STORY] US-024: Run 3 pilot tuning cycles and capture metrics' \
  'story,phase:1,area:agent-runtime,effort:L' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-024

**Parent epic:** E-05 — First Planner Agent Loop
**Effort:** L (8 pts)
**Impl guide:** Phase 1 success metrics (arch §08)
**Depends on:** US-021, US-022

### User story
As the squad lead, I want three iterations of the planner on real tasks (not just seed), with feedback captured, so that the prompt and CLAUDE.md converge before opening up to the wider squad.

### Acceptance criteria
- [ ] At least 3 different real tasks planned
- [ ] Squad debrief after each cycle, changes to CLAUDE.md / plan template captured
- [ ] Plan acceptance rate (approved as-is vs edited) tracked
- [ ] Avg token cost per plan recorded


_Parent epic: #__EPIC_E05___
BODY
echo "  created US-024: $LAST_ISSUE_URL"

create_issue '[STORY] US-025: Install filesystem MCP server' \
  'story,phase:1,area:mcp,effort:S' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-025

**Parent epic:** E-06 — MCP Server Ecosystem
**Effort:** S (1 pts)
**Impl guide:** §08.2
**Depends on:** US-002

### User story
As an engineer, I want the filesystem MCP server installed, so that the agent can read repo files via a sandboxed channel.

### Acceptance criteria
- [ ] `npm install -g @modelcontextprotocol/server-filesystem`
- [ ] `which mcp-server-filesystem` succeeds
- [ ] Server listed in `/mcp list` once configured


_Parent epic: #__EPIC_E06___
BODY
echo "  created US-025: $LAST_ISSUE_URL"

create_issue '[STORY] US-026: Install GitHub MCP server with fine-grained PAT' \
  'story,phase:1,area:mcp,effort:M' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-026

**Parent epic:** E-06 — MCP Server Ecosystem
**Effort:** M (3 pts)
**Impl guide:** §08.2, §08.4
**Depends on:** US-020, US-025

### User story
As an engineer, I want the GitHub MCP server installed and authenticated, so that the agent can open PRs and read issues without me writing custom code.

### Acceptance criteria
- [ ] `npm install -g @modelcontextprotocol/server-github`
- [ ] GH_AGENT_TOKEN env var injected (from E-04 PAT)
- [ ] Test: agent successfully lists last 5 PRs via the server


_Parent epic: #__EPIC_E06___
BODY
echo "  created US-026: $LAST_ISSUE_URL"

create_issue '[STORY] US-027: Configure project-scoped .claude/mcp.json' \
  'story,phase:1,area:mcp,effort:S' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-027

**Parent epic:** E-06 — MCP Server Ecosystem
**Effort:** S (2 pts)
**Impl guide:** §08.3
**Depends on:** US-026

### User story
As an engineer, I want .claude/mcp.json committed in the repo (not global), so that the MCP servers and their tokens are scoped to the pilot project.

### Acceptance criteria
- [ ] File exists in .claude/mcp.json
- [ ] References both filesystem and github servers
- [ ] Uses `${env:GH_AGENT_TOKEN}` (does not hard-code secret)
- [ ] Reviewed by squad lead before commit


_Parent epic: #__EPIC_E06___
BODY
echo "  created US-027: $LAST_ISSUE_URL"

create_issue '[STORY] US-028: Verify MCP integration end-to-end' \
  'story,phase:1,area:mcp,effort:S' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-028

**Parent epic:** E-06 — MCP Server Ecosystem
**Effort:** S (1 pts)
**Impl guide:** §08.5
**Depends on:** US-027

### User story
As the squad lead, I want a verifiable end-to-end test of the MCP wiring, so that we know the agent is actually calling tools rather than hallucinating their outputs.

### Acceptance criteria
- [ ] `/mcp list` in Claude Code shows both servers as `connected`
- [ ] Adversarial task: ask for non-existent file via filesystem MCP, agent reports error not invents content
- [ ] Tool-call traces visible in REPL


_Parent epic: #__EPIC_E06___
BODY
echo "  created US-028: $LAST_ISSUE_URL"

create_issue '[STORY] US-029: Design .agent/provenance.json schema' \
  'story,phase:1,area:provenance,effort:M' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-029

**Parent epic:** E-07 — Provenance & Compliance Workflow
**Effort:** M (3 pts)
**Impl guide:** §10.1
**Depends on:** US-013

### User story
As a governance reviewer, I want a documented schema for provenance, so that every PR's provenance file is parseable and audit-comparable.

### Acceptance criteria
- [ ] Schema documented in repo (JSON Schema or commented example)
- [ ] Required fields: run_id, task, agent_identity, human_approver, model, started_at, finished_at, prompt_hash, tool_trace, attachment_hashes, token_cost
- [ ] Reviewed by CISO delegate or governance council


_Parent epic: #__EPIC_E07___
BODY
echo "  created US-029: $LAST_ISSUE_URL"

create_issue '[STORY] US-030: Implement provenance writer in custom agent' \
  'story,phase:1,area:provenance,effort:M' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-030

**Parent epic:** E-07 — Provenance & Compliance Workflow
**Effort:** M (5 pts)
**Impl guide:** §10.1
**Depends on:** US-022, US-029

### User story
As an engineer, I want the headless agent to write .agent/provenance.json before its final commit, so that every agent PR carries auditable metadata.

### Acceptance criteria
- [ ] File written before `git commit` of agent's final change
- [ ] Token usage captured from API responses
- [ ] Tool trace populated from agent loop
- [ ] Hash of system prompt computed and stored


_Parent epic: #__EPIC_E07___
BODY
echo "  created US-030: $LAST_ISSUE_URL"

create_issue '[STORY] US-031: Build GitHub Actions agent-provenance workflow' \
  'story,phase:1,area:provenance,effort:L' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-031

**Parent epic:** E-07 — Provenance & Compliance Workflow
**Effort:** L (5 pts)
**Impl guide:** §10.2
**Depends on:** US-029

### User story
As a governance reviewer, I want an automated check that verifies provenance on every agent PR, so that human review is augmented by a machine guarantee.

### Acceptance criteria
- [ ] .github/workflows/agent-provenance.yml runs on pull_request to main where head_ref starts with agent/
- [ ] Fails if .agent/provenance.json missing
- [ ] Fails if required fields missing (jq schema check)
- [ ] Posts a summary PR comment with run_id, model, approver, cost


_Parent epic: #__EPIC_E07___
BODY
echo "  created US-031: $LAST_ISSUE_URL"

create_issue '[STORY] US-032: Wire agent-provenance as required status check on main' \
  'story,phase:1,area:provenance,effort:S' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-032

**Parent epic:** E-07 — Provenance & Compliance Workflow
**Effort:** S (2 pts)
**Impl guide:** §10.3
**Depends on:** US-031, US-018

### User story
As the squad lead, I want agent-provenance added to the branch-protection required checks, so that no agent PR can merge without passing it.

### Acceptance criteria
- [ ] `gh api .../branches/main/protection` shows agent-provenance in required_status_checks.contexts
- [ ] Test: PR from agent/* branch without provenance file shows merge button greyed out


_Parent epic: #__EPIC_E07___
BODY
echo "  created US-032: $LAST_ISSUE_URL"

create_issue '[STORY] US-033: Validate by attempting a no-provenance merge (negative test)' \
  'story,phase:1,area:provenance,effort:S' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-033

**Parent epic:** E-07 — Provenance & Compliance Workflow
**Effort:** S (2 pts)
**Impl guide:** §10.4
**Depends on:** US-032

### User story
As a governance reviewer, I want a deliberate negative test that opens an agent/* PR with no provenance file, so that we prove the gate actually blocks merges rather than just assuming it does.

### Acceptance criteria
- [ ] PR opened from an agent/* branch with .agent/provenance.json intentionally absent
- [ ] agent-provenance check goes red and the merge button is blocked
- [ ] Same PR, once a valid provenance.json is added, turns the check green and unblocks merge
- [ ] Result recorded in the compliance evidence log


_Parent epic: #__EPIC_E07___
BODY
echo "  created US-033: $LAST_ISSUE_URL"

create_issue '[STORY] US-034: Install Playwright + Chromium' \
  'story,phase:2,area:browser,effort:S' \
  'Phase 2 — Full agentic SDLC' <<'BODY'
## Story US-034

**Parent epic:** E-08 — Browser Verification (Playwright)
**Effort:** S (1 pts)
**Impl guide:** §11.1
**Depends on:** US-015

### User story
As an engineer, I want Playwright and its Chromium browser installed in the pilot repo, so that the agent has a real browser to drive for verification.

### Acceptance criteria
- [ ] `npm install -D @playwright/test`
- [ ] `npx playwright install --with-deps chromium` succeeds
- [ ] `npx playwright --version` returns a 1.x version
- [ ] playwright.config.ts committed with baseURL and chromium project


_Parent epic: #__EPIC_E08___
BODY
echo "  created US-034: $LAST_ISSUE_URL"

create_issue '[STORY] US-035: Author baseline visual regression test' \
  'story,phase:2,area:browser,effort:M' \
  'Phase 2 — Full agentic SDLC' <<'BODY'
## Story US-035

**Parent epic:** E-08 — Browser Verification (Playwright)
**Effort:** M (3 pts)
**Impl guide:** §11.2
**Depends on:** US-034

### User story
As an engineer, I want a baseline visual regression test that captures and compares screenshots, so that the agent can detect unintended UI changes.

### Acceptance criteria
- [ ] Test captures a screenshot of the key user journey
- [ ] `toHaveScreenshot` comparison runs with 1% pixel tolerance
- [ ] Baseline snapshots committed under tests/__snapshots__/
- [ ] Test passes on a clean run and fails on an injected visual diff


_Parent epic: #__EPIC_E08___
BODY
echo "  created US-035: $LAST_ISSUE_URL"

create_issue '[STORY] US-036: Build run-visual tool for the agent loop' \
  'story,phase:2,area:browser,effort:M' \
  'Phase 2 — Full agentic SDLC' <<'BODY'
## Story US-036

**Parent epic:** E-08 — Browser Verification (Playwright)
**Effort:** M (5 pts)
**Impl guide:** §11.3
**Depends on:** US-035

### User story
As an engineer, I want a run-visual tool the custom agent can invoke, so that the agent runs the Playwright suite and acts on structured pass/fail results.

### Acceptance criteria
- [ ] Tool wraps `npx playwright test` and returns structured JSON (pass/fail, diff paths)
- [ ] Registered as a callable tool in the custom agent loop
- [ ] Agent retries or stops based on the result, not on guesswork
- [ ] Failure surfaces diff image paths in the agent transcript


_Parent epic: #__EPIC_E08___
BODY
echo "  created US-036: $LAST_ISSUE_URL"

create_issue '[STORY] US-037: (Optional) Install Playwright MCP server' \
  'story,phase:2,area:browser,effort:S' \
  'Phase 2 — Full agentic SDLC' <<'BODY'
## Story US-037

**Parent epic:** E-08 — Browser Verification (Playwright)
**Effort:** S (2 pts)
**Impl guide:** §11.4
**Depends on:** US-034, US-027

### User story
As an engineer, I want the Playwright MCP server available inside the Claude Code REPL, so that I can drive the browser interactively as well as headlessly.

### Acceptance criteria
- [ ] Playwright MCP server installed
- [ ] Added to project-scoped .claude/mcp.json
- [ ] `/mcp list` shows the server as `connected`
- [ ] Agent can open a page and take a screenshot from the REPL


_Parent epic: #__EPIC_E08___
BODY
echo "  created US-037: $LAST_ISSUE_URL"

create_issue '[STORY] US-038: Register Slack app in Telenor workspace with required scopes' \
  'story,phase:1,area:intake,effort:M' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-038

**Parent epic:** E-09 — Slack Intake Bot
**Effort:** M (3 pts)
**Impl guide:** §12.1
**Depends on:** —

### User story
As the squad lead, I want a Slack app registered in the Telenor workspace with the right scopes, so that the bot can receive mentions and post interactive messages.

### Acceptance criteria
- [ ] Slack app created and approved in the Telenor workspace
- [ ] Bot scopes: app_mentions:read, chat:write, files:read, im:write
- [ ] Event subscriptions enabled for app_mention
- [ ] Signing secret and bot token stored securely (not committed)


_Parent epic: #__EPIC_E09___
BODY
echo "  created US-038: $LAST_ISSUE_URL"

create_issue '[STORY] US-039: Build bot scaffold with read-only first run' \
  'story,phase:1,area:intake,effort:M' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-039

**Parent epic:** E-09 — Slack Intake Bot
**Effort:** M (5 pts)
**Impl guide:** §12.2
**Depends on:** US-038

### User story
As an engineer, I want a minimal bot scaffold that acknowledges mentions read-only, so that we validate the event plumbing before adding any write or agent-trigger behaviour.

### Acceptance criteria
- [ ] Bot responds to @-mention with a simple ack message
- [ ] Slack request signature verification implemented
- [ ] Events handled within Slack's 3-second ack window
- [ ] No agent run is triggered yet (read-only milestone)


_Parent epic: #__EPIC_E09___
BODY
echo "  created US-039: $LAST_ISSUE_URL"

create_issue '[STORY] US-040: Implement intake handler with attachment hashing' \
  'story,phase:1,area:intake,effort:L' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-040

**Parent epic:** E-09 — Slack Intake Bot
**Effort:** L (8 pts)
**Impl guide:** §12.3
**Depends on:** US-039, US-023

### User story
As an engineer, I want the bot to normalise mentions, attachments, and URLs into an IntakeBundle, so that the agent receives a consistent, hashed, audit-ready input.

### Acceptance criteria
- [ ] Mentions, files, and URLs parsed into the IntakeBundle schema
- [ ] Each attachment hashed (SHA-256) and the hash recorded for provenance
- [ ] Untrusted content wrapped in `<untrusted_input>` tags (per US-023)
- [ ] Oversized or unsupported attachments rejected with a clear message


_Parent epic: #__EPIC_E09___
BODY
echo "  created US-040: $LAST_ISSUE_URL"

create_issue '[STORY] US-041: Implement Checkpoint 1 (plan approval) Block Kit flow' \
  'story,phase:1,area:intake,effort:L' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-041

**Parent epic:** E-09 — Slack Intake Bot
**Effort:** L (8 pts)
**Impl guide:** §12.4
**Depends on:** US-040, US-021

### User story
As a reviewer, I want Checkpoint 1 (plan approval) presented as a Block Kit interactive message, so that I can approve or reject a plan directly in Slack.

### Acceptance criteria
- [ ] Plan summary rendered as a Block Kit message with Approve / Reject buttons
- [ ] Approve advances the run; Reject halts it and records the reason
- [ ] Approver identity captured for provenance
- [ ] No source edits occur before an explicit approval


_Parent epic: #__EPIC_E09___
BODY
echo "  created US-041: $LAST_ISSUE_URL"

create_issue '[STORY] US-042: Implement Checkpoint 2 (PR review) DM flow' \
  'story,phase:1,area:intake,effort:M' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-042

**Parent epic:** E-09 — Slack Intake Bot
**Effort:** M (5 pts)
**Impl guide:** §12.5
**Depends on:** US-041

### User story
As a reviewer, I want Checkpoint 2 (PR review) delivered as a DM with the PR link and summary, so that I can review the agent's PR without leaving Slack.

### Acceptance criteria
- [ ] DM sent to the assigned reviewer with PR URL, diff summary, and provenance digest
- [ ] Reviewer can jump straight to the GitHub PR from the message
- [ ] Approve/request-changes action recorded and reflected on the run
- [ ] Falls back gracefully if the reviewer has DMs disabled


_Parent epic: #__EPIC_E09___
BODY
echo "  created US-042: $LAST_ISSUE_URL"

create_issue '[STORY] US-043: Implement Checkpoint 3 (deploy approval) flow' \
  'story,phase:1,area:intake,effort:M' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-043

**Parent epic:** E-09 — Slack Intake Bot
**Effort:** M (5 pts)
**Impl guide:** §12.6
**Depends on:** US-042

### User story
As the squad lead, I want Checkpoint 3 (deploy approval) as a final Block Kit gate, so that no deploy happens without an explicit human go-ahead in Slack.

### Acceptance criteria
- [ ] Deploy approval message lists target environment and change summary
- [ ] Approve triggers the deploy path; Reject halts and records the reason
- [ ] Approver identity and timestamp captured for provenance
- [ ] Gate is enforced even when prior checkpoints were auto-advanced


_Parent epic: #__EPIC_E09___
BODY
echo "  created US-043: $LAST_ISSUE_URL"

create_issue '[STORY] US-044: Run end-to-end smoke test per impl guide §13' \
  'story,phase:1,area:pilot,effort:M' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-044

**Parent epic:** E-10 — Phase 0/1 Smoke Test & Pilot Launch
**Effort:** M (3 pts)
**Impl guide:** §13.1
**Depends on:** US-024, US-033, US-043

### User story
As the squad lead, I want to run the full §13 smoke test end-to-end, so that we have objective proof Phase 0 + Phase 1 actually work together.

### Acceptance criteria
- [ ] All 8 checklist items from §13.1 pass
- [ ] A complete run is driven from Slack intake through to a merged agent PR
- [ ] Provenance gate, branch protection, and checkpoints all fire as designed
- [ ] Results recorded as the Phase 0/1 readiness evidence


_Parent epic: #__EPIC_E10___
BODY
echo "  created US-044: $LAST_ISSUE_URL"

create_issue '[STORY] US-045: Stand up metrics dashboard with 6 baseline metrics' \
  'story,phase:1,area:pilot,effort:M' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-045

**Parent epic:** E-10 — Phase 0/1 Smoke Test & Pilot Launch
**Effort:** M (5 pts)
**Impl guide:** §13.2
**Depends on:** US-024

### User story
As the squad lead, I want a dashboard tracking the 6 baseline metrics, so that the pilot's impact is measured rather than anecdotal.

### Acceptance criteria
- [ ] Dashboard live with: plan acceptance rate, cycle time, token cost/run, defect rate, rework rate, satisfaction
- [ ] Data sourced from provenance files and run logs
- [ ] Baseline values captured before the wider pilot starts
- [ ] Accessible to the squad and governance council


_Parent epic: #__EPIC_E10___
BODY
echo "  created US-045: $LAST_ISSUE_URL"

create_issue '[STORY] US-046: Run 2-week pilot with one squad, collect feedback' \
  'story,phase:1,area:pilot,effort:L' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-046

**Parent epic:** E-10 — Phase 0/1 Smoke Test & Pilot Launch
**Effort:** L (13 pts)
**Impl guide:** §13.3
**Depends on:** US-044, US-045

### User story
As the squad lead, I want one squad to run the agentic workflow for two weeks on real work, so that we gather defect, cost, and satisfaction data under realistic conditions.

### Acceptance criteria
- [ ] One squad runs real tasks through the agentic flow for 2 weeks
- [ ] The 6 baseline metrics collected throughout the period
- [ ] Defects, cost overruns, and friction logged with context
- [ ] End-of-pilot retro held and findings written up


_Parent epic: #__EPIC_E10___
BODY
echo "  created US-046: $LAST_ISSUE_URL"

create_issue '[STORY] US-047: Governance council Phase 0/1 sign-off review' \
  'story,phase:1,area:pilot,effort:M' \
  'Phase 1 — Plan-only pilot' <<'BODY'
## Story US-047

**Parent epic:** E-10 — Phase 0/1 Smoke Test & Pilot Launch
**Effort:** M (3 pts)
**Impl guide:** §13.4
**Depends on:** US-046

### User story
As the governance council, I want a formal Phase 0/1 review with the pilot evidence, so that we can record sign-off and make a go/no-go decision on Phase 2.

### Acceptance criteria
- [ ] Review meeting held with pilot metrics and findings presented
- [ ] Sign-off (or remediation list) recorded in the governance log
- [ ] Explicit go/no-go decision on Phase 2 captured
- [ ] Decision and rationale communicated to stakeholders


_Parent epic: #__EPIC_E10___
BODY
echo "  created US-047: $LAST_ISSUE_URL"


echo ""
echo "──────────────────────────────────────────────────────────────────"
echo "✓ Done."
echo "  Epics:      10  (E-01 … E-10)"
echo "  Stories:    47  (US-001 … US-047)"
echo "  Labels:     17"
echo "  Milestones:  3"
if $ADD_TO_PROJECT; then
  echo "  Project:    https://github.com/orgs/$PROJECT_OWNER/projects/$PROJECT_NUM"
fi
echo ""
echo "  Note: this script is NOT idempotent for issues — re-running"
echo "  duplicates all epics and stories. Labels and milestones are safe."
echo "──────────────────────────────────────────────────────────────────"
