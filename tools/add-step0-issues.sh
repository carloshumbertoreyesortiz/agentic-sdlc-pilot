#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# Telenor — Agentic SDLC pilot: add Epic E-00 (Capture Layer)
# Doc:  BACKLOG-AGENTIC-SDLC-001 Rev 1.1 addendum · 2026-06-19
# Companion to: IMPL-AGENTIC-SDLC-001 Rev 1.5, ARCH-AGENTIC-SDLC-001 Rev 1.6
#
# This script is ADDITIVE — it adds E-00 + 8 new stories (US-052..US-059) to a
# repo that already has E-01..E-10 + US-001..US-047 from create-issues.sh Rev 1.1.
# It also adds the missing area:capture label and comments on US-038 to mark it
# as superseded by US-054 (Slack app registration is now intake plumbing, E-00).
#
# Usage:
#   ./add-step0-issues.sh <owner/repo> [--project NUMBER --project-owner ORG]
#
# Example:
#   ./add-step0-issues.sh carloshumbertoreyesortiz/agentic-sdlc-pilot
#
# Prerequisites:
#   - gh CLI authenticated with `project,write:org,repo` scope
#   - Repo exists with the original create-issues.sh having already run
#   - The label `epic`, `story`, `phase:0`, `effort:S/M/L` already exist
#   - Milestone `Phase 0 — Foundation` already exists
# ──────────────────────────────────────────────────────────────────

set -euo pipefail

REPO=""
PROJECT_NUM=""
PROJECT_OWNER=""

while [ $# -gt 0 ]; do
  case "$1" in
    --project)        PROJECT_NUM="$2"; shift 2 ;;
    --project-owner)  PROJECT_OWNER="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,22p' "$0"; exit 0 ;;
    *)
      if [ -z "$REPO" ]; then REPO="$1"; shift
      else echo "Unknown arg: $1"; exit 1; fi ;;
  esac
done

if [ -z "$REPO" ]; then
  echo "Usage: $0 <owner/repo> [--project NUMBER --project-owner ORG]"
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
gh auth status >/dev/null 2>&1 || { echo "FAIL: gh not authenticated."; exit 1; }
gh repo view "$REPO" >/dev/null 2>&1 || { echo "FAIL: cannot access $REPO."; exit 1; }
if $ADD_TO_PROJECT; then
  gh project view "$PROJECT_NUM" --owner "$PROJECT_OWNER" >/dev/null 2>&1 || {
    echo "FAIL: cannot access project $PROJECT_OWNER/projects/$PROJECT_NUM."
    exit 1
  }
fi

add_to_project() {
  local issue_url="$1"
  if $ADD_TO_PROJECT; then
    gh project item-add "$PROJECT_NUM" --owner "$PROJECT_OWNER" --url "$issue_url" >/dev/null 2>&1 \
      || echo "    WARN: failed to add $issue_url to project"
  fi
}

# create_issue <title> <labels> <milestone>   <<'BODY' ... BODY
# Body is read from STDIN (heredoc on the call line) — never a here-doc
# so this parses under macOS bash 3.2. __E00_PARENT_NUM__ resolves to the
# E-00 epic number captured after the epic is created. (Pattern mirrors
# create-issues.sh.)
LAST_ISSUE_URL=""
E00_NUM=""   # set after E-00 is created; pre-init for set -u safety
create_issue() {
  local title="$1" labels="$2" milestone="$3" body
  body=$(cat)
  body=${body//__E00_PARENT_NUM__/$E00_NUM}
  LAST_ISSUE_URL=$(gh issue create -R "$REPO" \
    --title "$title" --label "$labels" --milestone "$milestone" --body "$body")
  add_to_project "$LAST_ISSUE_URL"
}

echo ""
echo "→ Creating new label (idempotent) ..."
gh label create 'area:capture' --color 'C5DEF5' --description 'DevOps AI Capture Layer — intake from Teams/Slack/Confluence/Jira/VS Code/CLI' -R "$REPO" 2>/dev/null || echo "  (skip: area:capture exists)"

echo ""
echo "→ Creating Epic E-00 ..."
create_issue '[EPIC] E-00: DevOps AI Capture Layer' \
  'epic,phase:0,area:capture' \
  'Phase 0 — Foundation' <<'EPICEOF'
## Epic E-00

The capability layer through which requirements enter the platform from any source where they natively arise: Teams meetings, Slack messages, Confluence pages, Jira tickets, VS Code Command Palette, and Terminal CLI. All six channels normalize to a single NormalizedIntake schema (same one used by E-09 Slack scaffold per US-039/US-040), so downstream agents are channel-agnostic. This is a clarification of how requirements enter the platform — not new scope. Per Praveen/Apoorv/Per feedback during the 2026-06-19 design review.

**Phase:** 0 · **Stories:** 8 · **Points:** 39
**Impl guide:** §00.5 (capture-layer.md)
**Companion:** IMPL-AGENTIC-SDLC-001 Rev 1.5 (docs/capture-layer.md), ARCH-AGENTIC-SDLC-001 Rev 1.6 §02.0

### Acceptance criteria
- [ ] All six capture channels (Teams, Slack, Confluence, Jira, VS Code, CLI) produce NormalizedIntake records that pass schema validation.
- [ ] End-to-end smoke test: a requirement captured via each channel surfaces in Claude Code as a plan-mode session within 60 seconds.
- [ ] Trust boundary preserved: every NormalizedIntake record carries trust:'untrusted' and content is wrapped per US-023 before reaching the planner.
- [ ] Author attribution recorded for every capture (name + email from the source channel), feeds into provenance.
- [ ] Capture Layer is operable independently per channel — a team that doesn't use Teams skips US-053 without breaking the rest.

### Stories in this epic
- [ ] US-052 — Define NormalizedIntake schema with all six source types (3 pts)
- [ ] US-053 — Teams app registration + meeting-transcript webhook (8 pts)
- [ ] US-054 — Slack intake handler — replaces US-038 from E-09 scope (5 pts)
- [ ] US-055 — Confluence watched-space subscription (5 pts)
- [ ] US-056 — Jira watched-project subscription (5 pts)
- [ ] US-057 — VS Code Command Palette extension — Send Selection to Agentic (5 pts)
- [ ] US-058 — Terminal CLI — `agentic capture` command (3 pts)
- [ ] US-059 — End-to-end Capture Layer smoke test through all six channels (5 pts)

EPICEOF
E00_NUM=${LAST_ISSUE_URL##*/}
echo "  created E-00 as issue #$E00_NUM"

echo ""
echo "→ Creating user stories US-052..US-059 ..."

create_issue '[STORY] US-052: Define NormalizedIntake schema with all six source types' \
  'story,phase:0,area:capture,effort:S' \
  'Phase 0 — Foundation' <<'STORYEOF'
## Story US-052

**Parent epic:** E-00 — DevOps AI Capture Layer
**Effort:** S (3 pts)
**Impl guide:** §00.5 capture-layer.md (schema section)
**Depends on:** US-040

### User story
As a platform engineer, I want one canonical TypeScript type for normalized capture records, so that downstream agents are channel-agnostic and can treat a Teams transcript identically to a Terminal CLI capture.

### Acceptance criteria
- [ ] src/capture/normalized.ts exports NormalizedIntake type with fields: source, source_ref, author{name,email}, captured_at, text, attachments[], trust, context
- [ ] source field is a string-literal union of: 'teams' | 'slack' | 'confluence' | 'jira' | 'vscode' | 'cli'
- [ ] trust field is the literal 'untrusted' — never anything else
- [ ] JSON Schema generated and committed at docs/normalized-intake.schema.json
- [ ] Unit tests cover all six source types with at least one valid + one invalid example each
- [ ] Reuses Attachment type from existing src/slack/bot.ts (US-040) — does not redefine it


_Parent epic: #__E00_PARENT_NUM__

STORYEOF
echo "  created US-052: $LAST_ISSUE_URL"

create_issue '[STORY] US-053: Teams app registration + meeting-transcript webhook' \
  'story,phase:0,area:capture,effort:L' \
  'Phase 0 — Foundation' <<'STORYEOF'
## Story US-053

**Parent epic:** E-00 — DevOps AI Capture Layer
**Effort:** L (8 pts)
**Impl guide:** §00.5.1 capture-layer.md (Teams)
**Depends on:** US-052

### User story
As a developer in a Teams meeting, I want the meeting transcript to flow into the platform automatically when the meeting ends, so that requirements discussed verbally become traceable capture records without me re-typing.

### Acceptance criteria
- [ ] Telenor M365 admin has registered the Teams app with Microsoft Graph permissions: OnlineMeetingTranscript.Read.All, User.Read.All
- [ ] Webhook subscription created for transcript-ready events on opted-in meetings
- [ ] Handler normalizes the transcript to NormalizedIntake with source:'teams', source_ref set to the Graph meeting ID
- [ ] Privacy boundary: only meetings explicitly tagged with [agentic] in the subject line are captured (opt-in, never opt-out)
- [ ] Smoke test: a recorded test meeting produces a NormalizedIntake record within 90 seconds of meeting end


_Parent epic: #__E00_PARENT_NUM__

STORYEOF
echo "  created US-053: $LAST_ISSUE_URL"

create_issue '[STORY] US-054: Slack intake handler — replaces US-038 from E-09 scope' \
  'story,phase:0,area:capture,effort:M' \
  'Phase 0 — Foundation' <<'STORYEOF'
## Story US-054

**Parent epic:** E-00 — DevOps AI Capture Layer
**Effort:** M (5 pts)
**Impl guide:** §00.5.2 capture-layer.md (Slack)
**Depends on:** US-052, US-040

### User story
As a developer in a Slack thread, I want to @-mention the agentic bot with a requirement and have it captured, so that informal requirements raised in chat enter the platform.

### Acceptance criteria
- [ ] US-038 (Slack app registration) is moved from E-09 to E-00 with the same acceptance criteria — same external dependency (Slack workspace admin)
- [ ] Intake handler from US-040 emits NormalizedIntake records with source:'slack', source_ref set to the Slack message ts
- [ ] E-09 stays focused on Slack-as-human-loop checkpoints (CP1/CP2/CP3) — separate concern from intake
- [ ] docs/slack.md updated to clarify the two distinct surfaces: intake (E-00) vs checkpoints (E-09)


_Parent epic: #__E00_PARENT_NUM__

STORYEOF
echo "  created US-054: $LAST_ISSUE_URL"

create_issue '[STORY] US-055: Confluence watched-space subscription' \
  'story,phase:0,area:capture,effort:M' \
  'Phase 0 — Foundation' <<'STORYEOF'
## Story US-055

**Parent epic:** E-00 — DevOps AI Capture Layer
**Effort:** M (5 pts)
**Impl guide:** §00.5.3 capture-layer.md (Confluence)
**Depends on:** US-052

### User story
As a product manager writing requirements on Confluence, I want pages I publish in designated spaces to enter the platform automatically, so that PM-authored requirements are not lost in translation when handed to engineering.

### Acceptance criteria
- [ ] Confluence API token created with read access to designated requirement spaces only (least-privilege)
- [ ] Watcher implemented as scheduled poll (every 5 min) — Confluence Cloud webhooks require an enterprise add-on Telenor may not have; verify with admin before assuming push
- [ ] Handler normalizes page content to NormalizedIntake with source:'confluence', source_ref set to the page ID and version
- [ ] De-duplication: a page edited twice within an hour produces one capture, not two
- [ ] Smoke test: a new page in the test space produces a NormalizedIntake within 6 minutes


_Parent epic: #__E00_PARENT_NUM__

STORYEOF
echo "  created US-055: $LAST_ISSUE_URL"

create_issue '[STORY] US-056: Jira watched-project subscription' \
  'story,phase:0,area:capture,effort:M' \
  'Phase 0 — Foundation' <<'STORYEOF'
## Story US-056

**Parent epic:** E-00 — DevOps AI Capture Layer
**Effort:** M (5 pts)
**Impl guide:** §00.5.4 capture-layer.md (Jira)
**Depends on:** US-052

### User story
As an engineer triaging Jira tickets, I want new tickets and ticket comments in designated projects to enter the platform automatically, so that the agentic flow can begin from a Jira ticket without manual copy-paste.

### Acceptance criteria
- [ ] Jira API token with read access to designated projects only
- [ ] Watcher: Jira Cloud webhooks for issue-created and issue-commented events (Jira supports webhooks natively, unlike Confluence in step above)
- [ ] Handler normalizes to NormalizedIntake with source:'jira', source_ref set to the issue key (e.g., PILOT-123)
- [ ] Comments append to the existing capture if the parent issue was already captured (one issue = one capture timeline, not many separate captures)
- [ ] Smoke test: creating a new Jira ticket in the test project produces a NormalizedIntake within 30 seconds


_Parent epic: #__E00_PARENT_NUM__

STORYEOF
echo "  created US-056: $LAST_ISSUE_URL"

create_issue '[STORY] US-057: VS Code Command Palette extension — Send Selection to Agentic' \
  'story,phase:0,area:capture,effort:M' \
  'Phase 0 — Foundation' <<'STORYEOF'
## Story US-057

**Parent epic:** E-00 — DevOps AI Capture Layer
**Effort:** M (5 pts)
**Impl guide:** §00.5.5 capture-layer.md (VS Code)
**Depends on:** US-052, US-058

### User story
As an engineer reading a spec, ticket, email, or any text in VS Code, I want to highlight a passage and run a Command Palette action to send it to the platform, so that requirements discovered anywhere in my editor become capture records in one keystroke.

### Acceptance criteria
- [ ] VS Code extension published to the team's private extension feed (not the public Marketplace)
- [ ] Command 'Agentic: Send Selection to Platform' visible in Command Palette when text is selected
- [ ] Optional second command 'Agentic: Send Active File' for whole-file captures
- [ ] Extension posts to a local capture endpoint (the agentic CLI from US-058 must be running, or extension surfaces a clear error message)
- [ ] NormalizedIntake produced with source:'vscode', source_ref set to file path + line range
- [ ] Self-service install — no admin needed once extension is published to the feed


_Parent epic: #__E00_PARENT_NUM__

STORYEOF
echo "  created US-057: $LAST_ISSUE_URL"

create_issue '[STORY] US-058: Terminal CLI — `agentic capture` command' \
  'story,phase:0,area:capture,effort:S' \
  'Phase 0 — Foundation' <<'STORYEOF'
## Story US-058

**Parent epic:** E-00 — DevOps AI Capture Layer
**Effort:** S (3 pts)
**Impl guide:** §00.5.6 capture-layer.md (CLI)
**Depends on:** US-052

### User story
As a developer working in a terminal, I want a `agentic capture` command that submits text from arguments, stdin, or a file, so that requirements I encounter in shell sessions (logs, files, paste buffer) enter the platform without leaving the terminal.

### Acceptance criteria
- [ ] CLI installable via `npm install -g @telenor/agentic-cli` (private npm feed)
- [ ] Three input modes: `agentic capture "<text>"` (inline), `agentic capture --file path.txt`, `cat foo.md | agentic capture --stdin`
- [ ] NormalizedIntake produced with source:'cli', source_ref set to the working directory + invocation timestamp
- [ ] Author resolved from `git config user.email` or $USER fallback; explicit override via --as <email>
- [ ] Acts as the local capture endpoint that the VS Code extension (US-057) posts to — same process, two entry points


_Parent epic: #__E00_PARENT_NUM__

STORYEOF
echo "  created US-058: $LAST_ISSUE_URL"

create_issue '[STORY] US-059: End-to-end Capture Layer smoke test through all six channels' \
  'story,phase:0,area:capture,effort:M' \
  'Phase 0 — Foundation' <<'STORYEOF'
## Story US-059

**Parent epic:** E-00 — DevOps AI Capture Layer
**Effort:** M (5 pts)
**Impl guide:** §00.5.7 capture-layer.md (smoke test)
**Depends on:** US-053, US-054, US-055, US-056, US-057, US-058

### User story
As the squad lead, I want a single smoke test that exercises every capture channel and confirms each produces a valid NormalizedIntake reaching the planner, so that the Capture Layer is verifiably operational before stakeholders rely on it.

### Acceptance criteria
- [ ] scripts/smoke-capture.ts iterates through all six channels (uses test fixtures for Teams/Slack/Confluence/Jira, real invocation for VS Code/CLI)
- [ ] Each channel: capture sent → NormalizedIntake received → schema validates → plan-mode session opens in Claude Code → first checkpoint prompt visible
- [ ] Skips any channel marked as 'not provisioned for this engineer' (a single dev rarely has all six set up)
- [ ] Output: per-channel PASS/FAIL with timing, written to artifacts/capture-smoke-YYYYMMDD.md
- [ ] Definition of done for E-00 — this story closes the epic


_Parent epic: #__E00_PARENT_NUM__

STORYEOF
echo "  created US-059: $LAST_ISSUE_URL"


echo ""
echo "→ Marking US-038 as superseded by US-054 ..."
# Find US-038 issue number
US038_NUM=$(gh issue list -R "$REPO" --state all --search 'US-038 in:title' --json number,title \
  -q 'map(select(.title | test("\\[STORY\\] US-038:")))[0].number // empty' 2>/dev/null || echo "")
if [ -n "$US038_NUM" ]; then
  SUPER_BODY=$(mktemp)
  cat > "$SUPER_BODY" <<'SUPEREOF'
**SUPERSEDED by US-054** (E-00 Capture Layer).

Slack app registration is now scoped under E-00 as **Slack-as-intake-channel** plumbing rather than E-09 (which stays focused on Slack-as-human-checkpoint-channel). Same Slack app, two distinct surfaces.

Closing this issue. Track equivalent work via US-054 in E-00.

Reference: ARCH-AGENTIC-SDLC-001 Rev 1.6 §02.0 (Capture Layer), IMPL-AGENTIC-SDLC-001 Rev 1.5 §00.5.2 (capture-layer.md).
SUPEREOF
  gh issue comment "$US038_NUM" -R "$REPO" --body-file "$SUPER_BODY" 2>/dev/null && echo "  commented on US-038 (#$US038_NUM)"
  rm -f "$SUPER_BODY"
  gh issue close "$US038_NUM" -R "$REPO" --reason "not planned" 2>/dev/null && echo "  closed US-038 as superseded"
else
  echo "  (US-038 not found — skipping supersession step)"
fi

echo ""
echo "──────────────────────────────────────────────────────────────────"
echo "✓  Done. E-00 added to $REPO."
echo "   Epic:  #$E00_NUM (E-00 DevOps AI Capture Layer)"
echo "   Stories: US-052..US-059 (8 new stories)"
EPIC_COUNT=$(gh issue list -R "$REPO" --label epic --state all --limit 200 --json number -q '. | length')
STORY_COUNT=$(gh issue list -R "$REPO" --label story --state all --limit 200 --json number -q '. | length')
echo "   Total backlog now: $EPIC_COUNT epics, $STORY_COUNT stories"
echo "──────────────────────────────────────────────────────────────────"
