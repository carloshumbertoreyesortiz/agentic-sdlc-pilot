#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Telenor — Agentic SDLC pilot: E-11 backlog seeder
# Doc:      BACKLOG-AGENTIC-SDLC-001 Rev 1.3 · Author: Carlos Reyes · 2026-07-02 (Amendment)
# Companion: docs/way-of-work.md Rev 1.7, docs/telenor-gap-analysis.md
# Lineage:  modeled on tools/create-issues.sh + tools/add-step0-issues.sh
#           per US-061; four-rule shell-script gate compliant per US-060.
#
# Creates E-11 epic + 18 stories US-062..US-079 covering the Telenor SFB
# DevOps way-of-work integration. Rev 1.3 incorporates upstream ownership of
# Matrix sync (#1595, Martin Aarseth Karlsen) mirroring #1121 pattern. Idempotent: re-running skips already-created
# issues via title-anchored `in:title` lookups (rule 3). Each write is
# re-fetched and asserted (rule 4). No heredoc-in-$() anywhere (rule 2).
# Parses clean under /bin/bash bash 3.2 (rule 1); tested by CC's shell-lint gate.
#
# Usage:
#   ./create-e11-issues.sh <owner/repo> [--project NUMBER --project-owner ORG]
#
# Example:
#   ./create-e11-issues.sh carloshumbertoreyesortiz/agentic-sdlc-pilot
#
# Prerequisites:
#   - gh CLI 2.40+ installed and authenticated
#   - Repo has labels: story, epic, phase:1, area:integration, area:capture,
#     area:visibility, area:governance, effort:S, effort:M, effort:L,
#     priority:P1, priority:P2, priority:P3, blocked
#   - Repo has milestone: "Phase 1 — Plan-only pilot"
#   - For --project: write access to the target project board
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── argument parsing ─────────────────────────────────────────────────────────
REPO=""
PROJECT_NUM=""
PROJECT_OWNER=""

while [ $# -gt 0 ]; do
  case "$1" in
    --project)       PROJECT_NUM="$2"; shift 2 ;;
    --project-owner) PROJECT_OWNER="$2"; shift 2 ;;
    -h|--help)       sed -n '2,28p' "$0"; exit 0 ;;
    *)
      if [ -z "$REPO" ]; then REPO="$1"; shift
      else echo "ERROR: unknown argument: $1"; exit 2; fi
      ;;
  esac
done

if [ -z "$REPO" ]; then
  echo "Usage: $0 <owner/repo> [--project NUMBER --project-owner ORG]"
  exit 2
fi

ADD_TO_PROJECT=false
if [ -n "$PROJECT_NUM" ] && [ -n "$PROJECT_OWNER" ]; then
  ADD_TO_PROJECT=true
fi

# ── pre-flight ───────────────────────────────────────────────────────────────
echo "→ Target repo:    $REPO"
if [ "$ADD_TO_PROJECT" = "true" ]; then
  echo "→ Project board:  https://github.com/orgs/$PROJECT_OWNER/projects/$PROJECT_NUM"
fi

echo "→ Verifying gh CLI ..."
gh auth status >/dev/null 2>&1 || { echo "FAIL: gh not authenticated. Run: gh auth login"; exit 3; }
gh repo view "$REPO" >/dev/null 2>&1 || { echo "FAIL: cannot access repo $REPO"; exit 3; }

MILESTONE="Phase 1 — Plan-only pilot"
gh api "repos/$REPO/milestones" --jq '.[].title' | grep -qxF "$MILESTONE" || {
  echo "FAIL: milestone \"$MILESTONE\" does not exist in $REPO"
  echo "      Create it first with: gh api repos/$REPO/milestones -f title=\"$MILESTONE\""
  exit 3
}
echo "  milestone \"$MILESTONE\" verified"

# Verify required labels exist
NEEDED_LABELS="story epic phase:1 area:integration area:capture area:visibility area:governance effort:S effort:M effort:L priority:P1 priority:P2 priority:P3 blocked"
# Fetch label list once; membership test is pipe-free (no SIGPIPE race
# with grep -q under set -o pipefail). See tools/README.md bug lineage.
EXISTING_LABELS=$(gh label list -R "$REPO" --limit 200 --json name --jq '.[].name')
MISSING_LABELS=""
for label in $NEEDED_LABELS; do
  case "
$EXISTING_LABELS
" in
    *"
$label
"*) ;;                                  # present
    *) MISSING_LABELS="$MISSING_LABELS $label" ;; # absent
  esac
done
if [ -n "$MISSING_LABELS" ]; then
  echo "FAIL: missing labels in $REPO:$MISSING_LABELS"
  echo "      Create them via gh label create <name> before re-running."
  exit 3
fi
echo "  all $(echo $NEEDED_LABELS | wc -w | tr -d ' ') required labels present"

# ── body-file phase (no heredoc-in-$() — bash 3.2 safe) ──────────────────────
# Bodies are written to temp files up front, then referenced by --body-file.
# This avoids the command-substitution-around-cat-heredoc pattern that
# breaks bash 3.2's parser (documented in tools/README.md per US-060).

BODY_DIR="$(mktemp -d -t e11-bodies-XXXXXX)"
trap 'rm -rf "$BODY_DIR"' EXIT
echo "→ Writing 19 body files to $BODY_DIR ..."

# ─── E-11 epic body ────────────────────────────────────────────────────────
cat > "$BODY_DIR/E-11.md" <<'BODY_END'
## E-11 — Telenor SFB DevOps Way-of-Work Integration

**Phase:** 1 · **Priority:** P1 · **Area:** integration

### Purpose

Adapt the agentic pilot to Telenor SFB team's existing DevOps way-of-work rather than reinventing it. The pilot participates in their sprint cadence, adopts their status taxonomy and issue schema, consumes upstream work where it exists (SFB TCR sync per #1121; Matrix sync per #1595), and adds pilot-specific value (per-flow success metrics, scope-freeze rule wired to provenance, cross-dashboard navigation). The pilot's role is coordinator and toolchain integrator; the SFB team implements the external-system syncs.

Carlos committed to this integration in the 2026-06-30 Telenor team meeting: *"I don't want to reinvent things or change things. The outcome is that I'm going to be adapting your ways of working to the project."*

### Scope

Eighteen stories covering: required issue field additions (Priority, Size, Sprint, Type, Sub Epic, SFB Case Number, Business Area, Business Analyst, External References, Caller, Alternate Contact); status taxonomy expansion (10 states per #1121 including Analysis, Development, User Acceptance Test, Leveransesjekk, Pending Requestor); six-role taxonomy with per-initiative Change Lead binding; two upstream integrations (SFB TCR schema conformance per US-072 — consumes upstream #1121 owned by Apoorv Shukla; Matrix ↔ GitHub sync conformance per US-075 — consumes upstream #1595 owned by Martin Aarseth Karlsen); three intake flows differentiated in metrics (US-078); scope-freeze rule wired to provenance (US-071); cross-dashboard navigation (US-073); team-routing configuration (US-070); process documentation (US-069, US-076); four issue templates including a dedicated Incident template for Matrix-sourced issues (US-068); coordination protocol with SFB team on both integrations (US-079).

### Execution priority (per Ingrid Marie Urdshals 2026-06-30 second reply)

1. **US-075 (Matrix ↔ GitHub conformance)** — highest priority. Ensures pilot schema receives what #1595 emits cleanly. Ingrid named the underlying automation as her most critical target because the current manual sync is "the most vulnerable and person-dependent task."
2. **US-072 (SFB TCR schema conformance)** — as soon as possible. Toil reduction for Ingrid's SF copy-paste work; depends on Apoorv's #1121 landing on the SFB side.

Foundation stories (US-062 field schema, US-063 status taxonomy, US-068 issue templates) must land before US-072 and US-075 can begin, because the conformance stories depend on the field, status, and template schema being in place. US-079 (SFB coordination protocol) runs in parallel with US-072/US-075.

### Companion documentation

- `docs/way-of-work.md` — process mapping, six roles, three flows, sync pattern, per-flow metrics
- `docs/telenor-gap-analysis.md` — verified gap analysis (11 sections, PR #106 merged 2026-07-02)
- ARCH-AGENTIC-SDLC-001 Rev 1.7 §02.5–§02.10 — architecture integration

### Acceptance criteria (epic-level)

- [ ] All 18 stories (US-062 through US-079) filed and linked as native sub-issues of E-11
- [ ] `docs/way-of-work.md` present on main; referenced by CLAUDE.md as governance document
- [ ] All 18 stories closed OR explicitly deferred to Phase 2 with documented rationale
- [ ] Per-flow success metrics operational in the dashboard (US-078)
- [ ] Scope-freeze rule enforced by provenance gate (US-071)
- [ ] Pilot schema conformance with #1121 verified against a sample SF-sourced issue (US-072)
- [ ] Pilot schema conformance with #1595 verified against a sample Matrix-sourced incident from Epic #826 (US-075, US-079)
- [ ] Ingrid's Matrix manual sync toil eliminated (baseline 1 → target 0 in key-person-risk metric) once #1595 ships on the SFB side

### Upstream dependencies

- **TelenorNorgeInternal/s06065-sfb-telenor-sfdc#1121** (SF TCR ↔ GitHub sync, assigned to Apoorv Shukla, In progress). US-072 conformance work synchronizes with #1121's schema definitions.
- **TelenorNorgeInternal/s06065-sfb-telenor-sfdc#1595** (Matrix ↔ GitHub sync, assigned to Martin Aarseth Karlsen, in Backlog on SfB Mobile CPQ Tasks). US-075 conformance work synchronizes with #1595's schema definitions. Sample data available in Epic #826 (47 of 64 live migrated Matrix incidents).
- **Project admin permissions on the pilot GitHub repo** (Carlos-mediated; required for US-062 field additions).

### Risks

- R-TELENOR-CONCURRENT-MIGRATION (Medium): SFB team simultaneously migrating Jira→GitHub, Salesforce Change Sets→Git/DevOps Center, plus adopting the agentic pilot. Four-way migration compounds change-fatigue.
- R-SFB-COORDINATION (Low): schema drift between upstream (#1121, #1595) and pilot's US-072/US-075 conformance work if not actively coordinated with Apoorv and Martin. Regular sync-check needed. US-079 addresses.

BODY_END

# ─── US-062 ───────────────────────────────────────────────────────────────
cat > "$BODY_DIR/US-062.md" <<'BODY_END'
## US-062 — Add required GitHub Project fields

_Parent epic: E-11_

**Phase:** 1 · **Effort:** L · **Priority:** P1 · **Area:** integration

### Problem

The pilot's GitHub Project board currently has only stock ProjectV2 fields; all categorization is done through labels. Telenor's Sprint_Planning Confluence page and Workshop #1 require first-class fields for Priority, Size, Sprint, Type, and SFB Case Number. Workshop #1 slide 6 adds Business Area. Issue #1121 adds Sub Epic, Business Analyst, and External References. Issue #1595 adds Caller and Alternate Contact for Matrix-sourced incident reporters. The pilot must adopt all these as native Project fields to interoperate with SFB team practice and to receive SF-sourced issues from #1121 and Matrix-sourced incidents from #1595 without translation shims.

### Scope

Add the following as GitHub Project custom fields on the pilot's Project #1 ("Agentic SDLC Pilot — Phase 0/1"):

1. **Priority** (single-select): P0, P1, P2, P3. Existing `priority:P0-P3` labels remain as read-only reflection; new work uses the field.
2. **Size** (single-select): S, M, L. No XL — matches #1121's Complexity → Size mapping (Easy/Fair → S, Medium → M, Hard → L). Existing `effort:S/M/L` labels remain as read-only reflection.
3. **Sprint** (iteration): 2-week iterations aligned with SFB sprint cadence. Field name: "Sprint".
4. **Type** (single-select): Feature, Story, Task, Bug, Incident. Native GitHub Issue Types where the API supports them; falls back to a Project single-select field if not. Incident type is Matrix-specific per #1595.
5. **Sub Epic** (single-select): Clean-Up, New Feature, Minor Improvements and Bug Fixes, Major Improvements and Bug Fixes, Matrix Defect. First four per #1121; Matrix Defect is a pilot-side value for US-075/US-079 with #1595's Error Type field mapping into it.
6. **SFB Case Number** (text): the Salesforce Case Number for issues originating from SF TCR Cases via #1121. Optional (present only for Flow B issues).
7. **Business Area** (single-select): the ~20 Telenor SFB business areas from Workshop #1 slide 6. Optional but recommended for Flow A and Flow B.
8. **Business Analyst** (single-select): the named BAs from Workshop #1 slide 6. Auto-populated via routing rules from Business Area where possible.
9. **External References** (structured): Reference Id, Reference Type (SFB, Matrix, Jira, other), Reference URL. For Matrix-sourced issues from #1595, Reference Id = INC-prefixed Matrix incident number, Reference URL = deep link to matrix.telenor.no incident.
10. **Caller** (text): the Matrix AIR user who created the incident (from #1595 field mapping). Present only for Type=Incident.
11. **Alternate Contact** (text): the alternate contact from the Matrix incident (from #1595 field mapping). Present only for Type=Incident.

### Acceptance criteria

- [ ] All eleven fields present on Project #1 with the specified type and options
- [ ] Field option strings match #1121 and #1595 exact wording where mapped (case-sensitive)
- [ ] Existing 60+ issues are NOT retroactively migrated in this story
- [ ] Documentation of each field's purpose added to `docs/way-of-work.md`
- [ ] Field-add script committed to `tools/` following US-061 pattern
- [ ] Verification pass confirming all fields are visible and settable via `gh api`
- [ ] Sample Matrix-sourced issue from Epic #826 tested against Caller + Alternate Contact fields

### Hard constraints

- Do NOT retroactively populate fields on existing issues in this story
- Do NOT delete or rename existing labels (`priority:*`, `effort:*`)
- Requires Project admin permissions on the GitHub Project

### Depends on

None. Foundation story for the rest of E-11.

### Blocks

US-063, US-068, US-072, US-075, US-078, US-079 all depend on the field schema being in place.

BODY_END

# ─── US-063 ───────────────────────────────────────────────────────────────
cat > "$BODY_DIR/US-063.md" <<'BODY_END'
## US-063 — Adopt SFB status taxonomy (10 states per #1121)

_Parent epic: E-11_

**Phase:** 1 · **Effort:** M · **Priority:** P1 · **Area:** integration

### Problem

The pilot's Status field currently has four values: Todo, In Progress, Blocked, Done. Telenor's Sprint_Planning Confluence page documents seven states. Issue #1121 documents ten states in actual working practice: Draft, Backlog, Ready for Development, Analysis, Development, User Acceptance Test, Ready for Deployment, Pending Requestor, Deployed, Done. The `Blocked` label remains orthogonal (flags external dependency, not lifecycle state).

The pilot adopts #1121's ten-state taxonomy — richer than Workshop #1's shorter list — because this is what the SFB team actually uses.

### Scope

1. Update the Project #1 Status field to include all ten states.
2. Preserve existing state mappings: Todo → Backlog or Ready for Development; In Progress → Development; Done → Done. Blocked retired as status (moves to label-only).
3. Update `CLAUDE.md` to reference the ten-state model as authoritative.
4. Update `docs/way-of-work.md` §5.
5. Document GitHub status ↔ SFB Case Process Stage + SFB Sprint Status mapping per #1121 in `docs/way-of-work.md` §7.
6. Note: "Leveransesjekk" (Norwegian: delivery check) is the SFB Salesforce term corresponding to User Acceptance Test. Preserve Norwegian spelling.

### Acceptance criteria

- [ ] Status field has all ten values in specified order
- [ ] Existing issues retain valid mapped status (no orphans)
- [ ] CLAUDE.md references the ten-state model
- [ ] `docs/way-of-work.md` §5 and §7 mapping tables complete
- [ ] Cross-reference to #1121's status transition rules
- [ ] Migration of existing 60+ issues is a separate Carlos-mediated pass (NOT part of this story)

### Depends on

US-062 (field schema).

### Blocks

US-072 (conformance testing), US-075 (Matrix status mapping).
BODY_END

# ─── US-064 ───────────────────────────────────────────────────────────────
cat > "$BODY_DIR/US-064.md" <<'BODY_END'
## US-064 — Adopt 2-week sprint cadence

_Parent epic: E-11_

**Phase:** 1 · **Effort:** M · **Priority:** P2 · **Area:** integration

### Problem

The pilot has no sprint structure today; milestones are used for phases (Phase 0/1/2), not time-boxed sprints. Telenor SFB operates on 2-week sprints per the Introduction Confluence page: Plan / Create-Review-Release (continuous) / Close. The pilot's sprint field (added in US-062) must align with the SFB cadence for joint scheduling.

### Scope

1. Configure the Sprint (iteration) field on Project #1 with 2-week iterations aligned with the SFB team's existing sprint boundaries — coordinate with Ingrid or Apoorv for the current sprint's start date.
2. Document sprint ceremonies in `docs/way-of-work.md` §2.
3. Add Sprint Planning template/checklist: BAs present TCRs, Change Lead confirms scope, estimates assigned.
4. Add Sprint Close template: retrospective and next-sprint adjustment.
5. Update the dashboard generator to render sprint burndown, scope-vs-delivered, and velocity per sprint.

### Acceptance criteria

- [ ] Sprint iteration field configured with 2-week cycle aligned to SFB sprints
- [ ] Plan and Close ceremony templates documented
- [ ] Dashboard renders sprint burndown for current sprint
- [ ] First sprint boundary identified in coordination with Ingrid/Apoorv
- [ ] Sprint field populated on initial sprint 1 subset (Carlos-mediated)

### Depends on

US-062 (Sprint field schema).

### Blocks

US-078 (per-flow metrics include sprint-scoped views).
BODY_END

# ─── US-065 ───────────────────────────────────────────────────────────────
cat > "$BODY_DIR/US-065.md" <<'BODY_END'
## US-065 — Document six-role taxonomy with per-initiative Change Lead binding

_Parent epic: E-11_

**Phase:** 1 · **Effort:** S · **Priority:** P1 · **Area:** integration

### Problem

The pilot's governance does not encode Telenor SFB roles; all responsibilities collapse to Carlos as sole operator. Workshop #1 identified six confirmed roles (Business Analyst, Administrator, Developer, Change Lead, Technical Lead, Initiative Lead) with no seventh needed. Ingrid confirmed 2026-06-30: Release Manager responsibility maps to Change Lead (not a distinct role); Change Lead identity is per-initiative — Ingrid holds it for SFB-originated work; Apoorv holds Technical Lead.

### Scope

1. Add role definitions to `docs/way-of-work.md` §3 (already present in Rev 1.7).
2. Document per-initiative Change Lead binding: not a hard-coded person; CP1/CP3 approval routes to initiative's Change Lead.
3. Update `CLAUDE.md` to reference the six-role model.
4. Document checkpoint routing in §4: CP1 = Change Lead (per-initiative); CP2 = Technical Lead; CP3 = Change Lead + Technical Lead jointly with Change Lead as final closure.
5. Name Ingrid as Change Lead (SFB) and Apoorv as Technical Lead in `docs/team-routing.yaml` (US-070).

### Acceptance criteria

- [ ] Six-role taxonomy documented in `docs/way-of-work.md` §3
- [ ] Per-initiative Change Lead binding documented
- [ ] Checkpoint → role mapping documented in §4
- [ ] CLAUDE.md references the six-role model
- [ ] No seventh "Release Manager" role introduced

### Depends on

None.

### Blocks

US-070 (team-routing config references roles).
BODY_END

# ─── US-066 ───────────────────────────────────────────────────────────────
cat > "$BODY_DIR/US-066.md" <<'BODY_END'
## US-066 — Wire checkpoint approvals to role-based routing

_Parent epic: E-11_

**Phase:** 1 · **Effort:** M · **Priority:** P2 · **Area:** integration

### Problem

The pilot's three checkpoints (CP1 plan approval, CP2 PR review, CP3 deployment gate) route to no specific person because the pilot operates solo. Once the SFB team joins, checkpoint approvals must route to the correct role holder based on the initiative that owns the work.

### Scope

1. Extend the provenance schema (US-071) to record CP1 and CP3 approver identity, timestamp, and approved-plan hash.
2. Update `.github/workflows/agent-provenance.yml` to validate CP1 approval identity matches the initiative's Change Lead per `docs/team-routing.yaml`.
3. Update `.github/CODEOWNERS` so CP2 PR review routes to initiative's Technical Lead by default.
4. Document routing behavior in `docs/way-of-work.md` §4.
5. Add a fallback for solo-operated initiatives (Carlos as sole reviewer) with explicit "Phase 0/1 exception" annotation.

### Acceptance criteria

- [ ] Provenance schema includes CP1 approver + CP3 approver fields
- [ ] Provenance gate validates approver against team-routing config
- [ ] CODEOWNERS routes PR review by initiative
- [ ] Solo-operated exception documented and audit-logged
- [ ] End-to-end test: unauthorized approver fails; authorized passes

### Depends on

US-065 (roles), US-070 (team-routing), US-071 (provenance schema extension).

### Blocks

US-072, US-075.
BODY_END

# ─── US-067 ───────────────────────────────────────────────────────────────
cat > "$BODY_DIR/US-067.md" <<'BODY_END'
## US-067 — UAT-must-complete-before-prod gate

_Parent epic: E-11_

**Phase:** 1 · **Effort:** M · **Priority:** P2 · **Area:** integration

### Problem

Telenor's Create_and_Review page requires: *"All acceptance criteria / test scenarios must be tested and documented in the GitHub issue. When all tests are documented and passed, the change can be promoted to production. Move the status in GitHub to Ready for Deployment."*

The pilot must enforce this at the CP2 → CP3 transition: no CP3 gate opens until UAT documentation is complete.

### Scope

1. Extend provenance schema (US-071) with `uat_documented` boolean and `uat_evidence_url` (link to UAT documentation).
2. Update CP3 gate workflow to fail if `uat_documented=false` OR `uat_evidence_url` is empty.
3. Add helper script surfacing UAT status on issue view.
4. Document rule in `docs/way-of-work.md` §4.
5. Add UAT documentation format to `.github/ISSUE_TEMPLATE/` templates (US-068).

### Acceptance criteria

- [ ] Provenance schema includes UAT documentation fields
- [ ] CP3 gate fails on missing UAT evidence
- [ ] UAT documentation format templated
- [ ] Test: Ready-for-Deployment without UAT fails gate
- [ ] Test: complete UAT evidence passes gate

### Depends on

US-063 (Ready for Deployment status), US-071 (provenance schema extension).
BODY_END

# ─── US-068 ───────────────────────────────────────────────────────────────
cat > "$BODY_DIR/US-068.md" <<'BODY_END'
## US-068 — Four issue templates (Feature, Story/Task, Bug, Incident) with Sub Epic + required fields

_Parent epic: E-11_

**Phase:** 1 · **Effort:** M · **Priority:** P1 · **Area:** integration

### Problem

The pilot repo has no `.github/ISSUE_TEMPLATE/` directory. Telenor's Types_of_Changes Confluence page and Workshop #1 slide 12 define three change types (Feature, Improvement, Clean-Up) with different documentation requirements. Issue #1121 refines this with Type + Sub Epic model and Complexity → Type mapping. Issue #1595 requires a fourth dedicated template for Matrix incidents — Ingrid currently uses the Task template as a workaround but explicitly noted: *"we probably should have a separate template for incidents that are more like what we have in Matrix."* The Incident template surfaces Matrix-specific fields (Caller, Alternate Contact) that other types don't need.

### Scope

1. Add `.github/ISSUE_TEMPLATE/feature.md` (Type = Feature): background and pains, business value, user story, AC. Required Type=Feature, Sub Epic=New Feature.
2. Add `.github/ISSUE_TEMPLATE/story-or-task.md` (Type = Story or Task): description, Sub Epic, AC conditional on Type=Story.
3. Add `.github/ISSUE_TEMPLATE/bug.md` (Type = Bug): description, expected vs actual, repro steps, Sub Epic classification.
4. Add `.github/ISSUE_TEMPLATE/incident.md` (Type = Incident): dedicated template for Matrix-sourced issues per #1595. Title pattern includes INC-prefixed number ("📝INC0XXXXXX - Description"). Body sections: Description, Caller (required), Alternate Contact (optional), Error Type → Sub Epic mapping, Priority, Attachments handling note. Auto-populated by #1595 sync; manually usable by Ingrid until #1595 ships.
5. Each template surfaces required fields: Priority, Size, Sprint (blank), Type, Sub Epic. Incident template additionally requires Caller.
6. Add `config.yml` disabling blank issues.

### Acceptance criteria

- [ ] Four templates present in `.github/ISSUE_TEMPLATE/`
- [ ] Blank issues disabled via config.yml
- [ ] Each template surfaces Type + Sub Epic prominently
- [ ] Incident template surfaces Caller + Alternate Contact prominently
- [ ] Field option strings match US-062 field values exactly
- [ ] Templates render correctly in GitHub UI (verified via test issue for each)
- [ ] Incident template tested against a sample from Epic #826 to confirm compatibility with #1595's expected output
- [ ] Cross-referenced in `docs/way-of-work.md` §6

### Depends on

US-062 (field schema including Caller and Alternate Contact).

### Blocks

US-072 (SF-sourced issues use Feature/Story/Task templates via #1121 mapping), US-075 (Matrix-sourced use incident.md template), US-079 (coordination testing uses templates).

BODY_END

# ─── US-069 ───────────────────────────────────────────────────────────────
cat > "$BODY_DIR/US-069.md" <<'BODY_END'
## US-069 — Capture layer channel inventory rationalization

_Parent epic: E-11_

**Phase:** 1 · **Effort:** S · **Priority:** P2 · **Area:** capture

### Problem

The original E-00 capture layer defines six channels (Teams, Slack, Confluence, Jira, VS Code Palette, Terminal CLI). Ingrid's 2026-06-30 email describes three actual intake flows with channels that don't match E-00 exactly: Flow A mentions Teams/Slack/Confluence/Outlook (Outlook not in E-00); does NOT use Jira. Flow B is Salesforce (via #1121) — not in E-00. Flow C is Matrix/ServiceNow — not in E-00.

### Scope

1. Update `docs/capture-layer.md` §00.5 channel table:
   - Keep: Teams, Slack, Confluence, VS Code Palette, Terminal CLI
   - Add: Outlook (email intake per Ingrid's "50% requirements come through email")
   - Add: Salesforce (Flow B, via #1121 — upstream ownership; pilot receives, doesn't implement)
   - Add: Matrix/ServiceNow (Flow C, via US-075)
   - Mark Jira as deprecated for SFB context; keep schema support for other teams
2. Document E-00 ↔ three-flow mapping in `docs/way-of-work.md` §1.
3. Update `NormalizedIntake` type to add `salesforce` and `matrix` source values; deprecate `jira` for SFB.

### Acceptance criteria

- [ ] `docs/capture-layer.md` channel table updated
- [ ] Jira marked deprecated-for-SFB
- [ ] `NormalizedIntake` type updated (or story filed for US-052 schema update)
- [ ] Cross-reference to `docs/way-of-work.md` §1
- [ ] No code changes to existing channel handlers

### Depends on

None.
BODY_END

# ─── US-070 ───────────────────────────────────────────────────────────────
cat > "$BODY_DIR/US-070.md" <<'BODY_END'
## US-070 — Team-routing configuration

_Parent epic: E-11_

**Phase:** 1 · **Effort:** S · **Priority:** P2 · **Area:** integration

### Problem

The capture layer needs to route incoming requirements to the right Business Analyst by Business Area, and checkpoint gates (US-066) need to route CP1/CP3 approvals to the right Change Lead / Technical Lead by initiative. Routing must be configurable and version-controlled.

### Scope

1. Create `docs/team-routing.yaml`:
   - Named individuals (Workshop #1 slide 6) with GitHub or Slack handles and business area responsibilities
   - Initiative → Change Lead mapping. SFB work: Ingrid Marie Urdshals. Pilot itself: Carlos Reyes.
   - Initiative → Technical Lead mapping. All Telenor: Apoorv Shukla. Pilot-scoped: Carlos.
   - Business Area → BA mapping (from Workshop #1 slide 6)
2. Add YAML schema validation via `.github/workflows/validate-routing.yml`.
3. Reference from `docs/way-of-work.md` §3 and §4.
4. Use GitHub/Slack handles as primary identifier; avoid raw email if privacy concern.

### Acceptance criteria

- [ ] `docs/team-routing.yaml` present with schema documented
- [ ] YAML validation workflow in place
- [ ] Named individuals listed with handles (not raw email)
- [ ] Initiative → Change Lead / Technical Lead mappings encoded
- [ ] Business Area → BA mapping complete for all ~20 areas
- [ ] Reviewed by Ingrid before commit (confidentiality check)

### Depends on

US-065 (role taxonomy).

### Blocks

US-066 (checkpoint routing reads this config).
BODY_END

# ─── US-071 ───────────────────────────────────────────────────────────────
cat > "$BODY_DIR/US-071.md" <<'BODY_END'
## US-071 — Scope-freeze rule wired to provenance

_Parent epic: E-11_

**Phase:** 1 · **Effort:** S · **Priority:** P1 · **Area:** governance

### Problem

Workshop #1 slide 11: *"Only functionality agreed upon during Create and Review is relevant for confirmation. New functionality or adjustments on the functionality deployed must be reported as a new change request."*

The pilot's CLAUDE.md has a per-task discipline rule ("Stay in scope") but does NOT encode the Telenor scope-freeze rule that binds CP1 → CP2 → CP3 progression. Without this rule, the agentic loop could silently expand scope post-CP1, and CP3 confirmation would have no audit trail against the original approved plan.

### Scope

1. Add scope-freeze rule to `CLAUDE.md` as a hard rule with explicit CP1 / CP2 / CP3 binding language.
2. Extend `provenance.schema.json` to include `scope_anchor` — reference to CP1-approved plan hash. Every subsequent provenance record for the same story carries the same scope_anchor.
3. Update CP3 gate workflow to compare delivered work vs scope_anchor; scope expansion fails the gate with a directive to file a new issue.
4. Update `docs/way-of-work.md` §8.
5. Add test case demonstrating scope-freeze enforcement.

### Acceptance criteria

- [ ] Scope-freeze rule added to CLAUDE.md hard rules
- [ ] `provenance.schema.json` extended with `scope_anchor` field
- [ ] CP3 gate compares delivered work vs scope_anchor
- [ ] Test: PR expanding scope beyond CP1 fails gate
- [ ] `docs/way-of-work.md` §8 references rule + enforcement

### Ordering risk

CC previously flagged that US-071's provenance schema change affects every future agent PR — including the gate on US-071's own PR. Mitigation: implement backward-compatible schema (scope_anchor nullable during grace period recorded in schema), then flip to required after in-flight PRs merge. Document grace-period ending in PR description.

### Depends on

None. Foundation governance story.

### Blocks

US-066, US-067, US-072, US-075.
BODY_END

# ─── US-072 ───────────────────────────────────────────────────────────────
cat > "$BODY_DIR/US-072.md" <<'BODY_END'
## US-072 — SFB TCR schema conformance

_Parent epic: E-11_

**Phase:** 1 · **Effort:** S · **Priority:** P1 · **Area:** integration

### Problem

The SFB team is building SF TCR Case → GitHub Issue sync as TelenorNorgeInternal/s06065-sfb-telenor-sfdc#1121 ("Sync between SFB and GitHub"), opened by Ingrid Marie Urdshals 2026-01-07, self-assigned to Apoorv Shukla, marked "In progress". The sync populates GitHub issues with a defined schema: Type + Sub Epic mapped from SFB Type + Complexity, Complexity → Size mapping, field mappings (Subject → Title, etc.), status transition rules, External References mechanism.

The agentic pilot does not duplicate #1121. Instead, the pilot ensures its issue schema is compatible with what #1121 emits so pilot-owned repos can receive SF-sourced issues without translation shims.

### Scope

1. Verify pilot's Project fields (US-062) match #1121's field mapping table exactly.
2. Verify pilot's Status field (US-063) supports all #1121 status values with correct spellings including "Leveransesjekk".
3. Verify pilot's issue templates (US-068) accept auto-population from #1121's field mapping without user interaction.
4. Coordinate with Apoorv on exact schema #1121 emits — coordination email or 15-min call.
5. Build conformance test: mock SF TCR payload → pilot's issue-creation endpoint → validate all required fields populated. Test in `tests/sfb-conformance.test.ts`.
6. Document conformance in `docs/way-of-work.md` §1.

### Acceptance criteria

- [ ] Pilot field schema matches #1121's mapping table exactly
- [ ] Pilot status taxonomy supports all #1121 values
- [ ] Conformance test passes against mock SF TCR payload
- [ ] Apoorv confirmation that pilot schema aligns
- [ ] `docs/way-of-work.md` cross-references #1121's mapping tables

### Hard constraints

- Do NOT re-implement #1121's sync logic
- If #1121's schema changes, US-072 reopens for rebase
- No modifications to TelenorNorgeInternal org — coordination only

### Depends on

US-062, US-063, US-068. Upstream: Apoorv's #1121 implementation.

### Priority (per Ingrid 2026-06-30 second reply)

Second-highest in E-11 after US-075. Ingrid wants automation "as soon as possible" to reduce copy-paste toil.
BODY_END

# ─── US-073 ───────────────────────────────────────────────────────────────
cat > "$BODY_DIR/US-073.md" <<'BODY_END'
## US-073 — Cross-dashboard navigation

_Parent epic: E-11_

**Phase:** 1 · **Effort:** S · **Priority:** P3 · **Area:** visibility

### Problem

Two dashboards exist and complement each other: the pilot's GitHub Pages dashboard (delivery tracking) and the Telenor Salesforce dashboard at SF Dashboard ID `01ZdV000000uD2bUAE` (TCR intake tracking). Neither links to the other.

### Scope

1. Add top-level link on pilot's GitHub Pages dashboard to the SF SFB Request Backlog dashboard.
2. Include one-line explanation of each dashboard's coverage.
3. Reverse link (SF → GitHub Pages) is out of scope — requires SF admin work Ingrid can arrange independently.
4. Update `docs/way-of-work.md` §9.

### Acceptance criteria

- [ ] Pilot dashboard shows SF dashboard link with brief description
- [ ] Link uses correct SF dashboard URL (verified with Ingrid)
- [ ] SF dashboard link opens with correct scope (Telenor SSO)

### Depends on

None.
BODY_END

# ─── US-074 ───────────────────────────────────────────────────────────────
cat > "$BODY_DIR/US-074.md" <<'BODY_END'
## US-074 — SFB-GitHub sync health KPI

_Parent epic: E-11_

**Phase:** 1 · **Effort:** S · **Priority:** P2 · **Area:** visibility

### Problem

Once #1121's SF TCR → GitHub sync is live, the pilot dashboard should surface a sync-health KPI so drift is visible: "X of Y approved SFB Cases have linked GitHub issues." Before #1121 lands, this measures Ingrid's manual sync completeness. After #1121 lands, it measures automation reliability.

### Scope

1. Extend `scripts/dashboard.ts` to compute sync-health metric: count GitHub issues with SFB Case Number populated vs total approved SFB Cases (Phase 1 uses snapshot approach to avoid SF API dependency at build time).
2. Add dashboard tile showing ratio + short list of missing SFB Cases.
3. Document metric definition in generator code.
4. When #1121 lands, revisit snapshot vs live SF API call.

### Acceptance criteria

- [ ] Sync-health tile visible on dashboard
- [ ] Metric definition documented in code
- [ ] Snapshot artifact source documented
- [ ] Tile renders correctly on live Pages deploy

### Depends on

US-062 (SFB Case Number field), US-073 (cross-dashboard linking context).
BODY_END

# ─── US-075 ───────────────────────────────────────────────────────────────
cat > "$BODY_DIR/US-075.md" <<'BODY_END'
## US-075 — Matrix ↔ GitHub schema conformance (consume upstream #1595)

_Parent epic: E-11_

**Phase:** 1 · **Effort:** S · **Priority:** P1 · **Area:** integration

### Problem

Matrix is Telenor's local ServiceNow instance at matrix.telenor.no. Access is controlled by the "Authorized Incident Reporter" (AIR) role, requested per KB0010037. Accenture developers (priyanka-nayak02, satish151994, thomasgtelenor, luis-martins-telenor) responsible for troubleshooting incidents do not have Matrix access; Ingrid personally creates a GitHub issue for each Matrix incident, tracks progress in GitHub, and manually updates Matrix based on GitHub state. This bidirectional manual toil is the "most vulnerable and person-dependent task" in the SFB team's workflow (Ingrid's own words).

The SFB team is building the Matrix ↔ GitHub bidirectional sync automation as TelenorNorgeInternal/s06065-sfb-telenor-sfdc#1595 ("Sync between Matrix and GitHub"), opened by Ingrid on 2026-02-27, assigned to Martin Aarseth Karlsen, currently in Backlog on the SfB Mobile CPQ Tasks board. #1595's specification defines: the three sub-flows (new incident intake, update from reporter, update from developer), the field mapping (Caller, Alternate Contact, Error Type → Sub Epic, Priority, Attachments), the note-handling rules for both directions.

The agentic pilot does not duplicate #1595's implementation. Instead, the pilot ensures its issue schema is compatible with what #1595 emits so pilot-owned repos can receive Matrix-sourced incidents without translation shims. This mirrors the US-072 pattern for #1121.

### Scope

1. Verify pilot's Project fields (US-062) match #1595's field mapping exactly, especially the new Caller and Alternate Contact fields for reporter identity preservation.
2. Verify pilot's Status field (US-063) supports the Matrix incident lifecycle states (New → Analysis → Development → User Acceptance Test → Ready for Deployment → Deployed → Done, with Resolve triggering closure).
3. Verify pilot's Incident template (US-068) accepts auto-population from #1595's field mapping including the "📝INCXXXXXXX - Description" title convention.
4. Coordinate with Martin Aarseth Karlsen (#1595 assignee) on the exact schema #1595 emits — coordination handled by US-079.
5. Build a conformance test: mock Matrix incident payload (using real sample from Epic #826, e.g. INC0067364) → pilot's issue-creation endpoint → validate all required fields populated including Caller, Alternate Contact, Sub Epic=Matrix Defect, External References with Matrix Reference Type. Test in `tests/matrix-conformance.test.ts`.
6. Verify pilot's note-handling logic (from US-068 templates + agent workflows) matches #1595's rules: Matrix note → GitHub comment; GitHub comment-no-close → Matrix Additional Comments; GitHub comment-with-close → Matrix closure information.
7. Document conformance in `docs/way-of-work.md` §1 and §7.

### Acceptance criteria

- [ ] Pilot field schema matches #1595's field mapping exactly (including Caller, Alternate Contact)
- [ ] Pilot Incident template accepts #1595's expected output format
- [ ] Conformance test passes against a sample from Epic #826 (real INC-prefixed incident)
- [ ] Martin confirmation that pilot schema aligns with #1595 emissions
- [ ] Note-handling rules documented and matched to #1595's specification
- [ ] `docs/way-of-work.md` cross-references #1595's field mapping and rules

### Hard constraints

- Do NOT re-implement #1595's sync logic. Pilot conforms to; does not compete with.
- If #1595's schema changes, US-075 reopens for rebase.
- No modifications to TelenorNorgeInternal org — coordination only (US-079 handles).

### Depends on

US-062 (fields including Caller, Alternate Contact), US-063 (status), US-068 (Incident template), US-071 (scope-freeze provenance). Upstream: Martin's #1595 implementation. Coordination: US-079.

### Priority rationale

Ingrid 2026-06-30 (second reply): *"The Matrix ↔ GitHub sync is the most critical to get in place since this is the most vulnerable and person-dependent task."* The underlying business-continuity risk mitigation belongs to #1595 (SFB team owned). The pilot's role — schema conformance — is priority-P1 because it's the precondition for pilot-owned repos to consume #1595's outputs when it ships.

BODY_END

# ─── US-076 ───────────────────────────────────────────────────────────────
cat > "$BODY_DIR/US-076.md" <<'BODY_END'
## US-076 — Three-flow routing rules

_Parent epic: E-11_

**Phase:** 1 · **Effort:** M · **Priority:** P2 · **Area:** integration

### Problem

The planner agent produces plans from `NormalizedIntake` records without differentiating by flow. The three flows have different characteristics that should shape planner behavior:

- Flow A (larger initiatives via dialogue): free-form transcripts, need epics + stories with Business Area classification and BA routing
- Flow B (SFB TCR via #1121): arrives pre-classified with all required fields; minimal planner reformatting
- Flow C (Matrix defects via US-075): produces Bug-type issues linked to Matrix incidents; triage-focused output

### Scope

1. Add three-flow recognition rules to CLAUDE.md documenting planner behavior per `source` field of `NormalizedIntake`.
2. Update `scripts/agent-planner.ts` to branch on source type with flow-specific templating.
3. Flow A: full requirement decomposition (epic + stories + AC per Type).
4. Flow B: verification pass on pre-populated fields; skip planning if all required fields present.
5. Flow C: bug triage output — repro steps, hypothesis, next-action recommendation.
6. Document in `docs/way-of-work.md` §1.

### Acceptance criteria

- [ ] CLAUDE.md documents three-flow planner behavior
- [ ] `agent-planner.ts` branches on source with explicit handling
- [ ] Test cases for each flow produce appropriately-shaped plans
- [ ] No cross-flow contamination

### Depends on

US-069 (channel inventory reflects three flows in schema).
BODY_END

# ─── US-077 ───────────────────────────────────────────────────────────────
cat > "$BODY_DIR/US-077.md" <<'BODY_END'
## US-077 — Adoption risk register additions

_Parent epic: E-11_

**Phase:** 1 · **Effort:** S · **Priority:** P2 · **Area:** governance

### Problem

Three new risks surfaced during E-11 scoping that are not yet in `docs/risks.md`:

1. **R-TELENOR-CONCURRENT-MIGRATION** (Medium): SFB team simultaneously migrating Jira→GitHub, Salesforce Change Sets→Git/DevOps Center, adopting the agentic pilot, and integrating with Matrix. Four-way migration compounds change-fatigue and rollback complexity.

2. **R-SERVICENOW-DEPENDENCY** (Low): US-075 depends on ServiceNow admin cooperation for AIR-role service account. If admin queue is long, US-075 slips.

3. **R-SFB-COORDINATION** (Low): schema drift between #1121 and pilot's US-072 conformance work if not actively coordinated with Apoorv. Regular sync-check needed.

### Scope

1. Add all three risks to `docs/risks.md` following R-01…R-05 row format.
2. Each risk includes: severity, current status (Open with exit trigger), description, mitigation strategy, exit condition.
3. Cross-reference from architecture doc §02.7.

### Acceptance criteria

- [ ] All three risks present in `docs/risks.md`
- [ ] Each has explicit exit trigger
- [ ] Cross-referenced from architecture and `docs/way-of-work.md`
- [ ] Reviewed by Carlos and Ingrid before final commit

### Depends on

None.
BODY_END

# ─── US-078 ───────────────────────────────────────────────────────────────
cat > "$BODY_DIR/US-078.md" <<'BODY_END'
## US-078 — Per-flow Phase 1 success metrics + key-person-risk KPI

_Parent epic: E-11_

**Phase:** 1 · **Effort:** M · **Priority:** P2 · **Area:** visibility

### Problem

The pilot's Phase 1 success is currently measured with a single aggregated metric (stories closed / stories total). The three intake flows have different baselines and different improvement curves. Aggregating obscures which value proposition is landing. Per-flow metrics let the council see clearly whether the pilot delivers value where promised.

### Scope

Extend the dashboard generator with per-flow computed metrics + key-person-risk KPI.

**Flow A metrics:**
- Number of channels operational (baseline 0, target 4+ of 6)
- Intakes per channel per week
- CP1 acceptance rate on planner-generated plans
- Time from intake to CP1 approval

**Flow B metrics:**
- Number of SF TCR Cases synced to GitHub via #1121 per sprint (dependent on Apoorv's implementation)
- Pilot schema conformance rate (% of received issues requiring no translation shim)
- Manual copy-paste time saved per week (baseline: Ingrid's current effort)

**Flow C metrics:**
- Number of Matrix incidents synced to GitHub via US-075 per week
- Manual sync effort saved per week (baseline: Ingrid's current effort)
- GitHub → Matrix reverse-sync latency
- Sync failure rate

**Cross-flow — key-person-risk KPI:**
- Count of business-critical processes still dependent on a single person's manual work
- Baseline at Phase 1 kickoff: 1 (Ingrid's Matrix ↔ GitHub sync)
- Target at Phase 1 exit: 0

### Acceptance criteria

- [ ] All flow-specific metrics computed and rendered on dashboard
- [ ] Key-person-risk KPI prominent (headline tile)
- [ ] Metric definitions documented in generator code
- [ ] Historical values persisted for trend visibility
- [ ] Dashboard remains cleanly generated at Pages-deploy time (US-051 pattern preserved)

### Depends on

US-062 (field schema), US-064 (sprint field), US-069 (three-flow schema in NormalizedIntake), US-075 (Flow C metrics need Matrix sync operational).

### Priority rationale

Per-flow metrics are how the council evaluates Phase 1's success across the three intake models. Without differentiation, the SFB team can't tell whether the pilot lands value for Flow C (Ingrid's high-priority target) or is dragged down by Flow A (still in scaffold state).
BODY_END


# ─── US-079 ───────────────────────────────────────────────────────────────
cat > "$BODY_DIR/US-079.md" <<'BODY_END'
## US-079 — SFB team coordination protocol for #1121 and #1595 conformance

_Parent epic: E-11_

**Phase:** 1 · **Effort:** M · **Priority:** P2 · **Area:** integration

### Problem

The pilot's US-072 and US-075 are conformance stories that depend on the SFB team's #1121 (Apoorv) and #1595 (Martin) implementations. Without active coordination between the pilot and the SFB team, schema drift is inevitable: #1121 or #1595 could change field names, values, or mapping rules after pilot conformance work lands, breaking pilot-owned repos that receive SF-sourced or Matrix-sourced issues.

Additionally, the pilot needs a way to validate conformance against real production data. Epic #826 ("Incidents from Matrix '26") in the SFB team's repo contains 47 of 64 manually-migrated Matrix incidents — real INC-prefixed sample data that represents exactly what #1595 will produce once automated. This is the conformance test suite the pilot needs.

### Scope

1. **Establish a coordination protocol with Apoorv Shukla and Martin Aarseth Karlsen:**
   - Weekly sync check: verify #1121 and #1595 field mappings against pilot's US-062 schema
   - Change-notification protocol: SFB team informs pilot before merging any schema changes to #1121 or #1595
   - Pilot informs SFB team before adding fields that might conflict with upstream field names
   - Document the protocol in `docs/way-of-work.md` §11 (Coordination cadence)

2. **Build a conformance test harness against Epic #826 sample data:**
   - Fetch a representative subset of Epic #826 sub-issues (e.g., 5 diverse INC examples: forecasting error, subscription missing, Salesforce sync failure, email notification failure, contract issue)
   - For each sample, produce the expected pilot-side GitHub issue (using US-068 Incident template)
   - Assert schema conformance: title format, Caller field, Alternate Contact field, Sub Epic=Matrix Defect, External References populated with Matrix Reference Type and INC-prefixed Reference Id
   - Test lives in `tests/conformance/matrix-sample-data.test.ts` with the samples in `tests/conformance/matrix-samples.json`
   - Similar test harness for #1121: sample SF TCR Cases → expected pilot-side issues

3. **Coordinate on shared taxonomies:**
   - Sub Epic values (Clean-Up, New Feature, Minor Improvements and Bug Fixes, Major Improvements and Bug Fixes, Matrix Defect) — align pilot to SFB team's naming
   - Priority values (P0/P1/P2/P3) — align to SFB team's Priority scale
   - Business Area list — align to Workshop #1 slide 6

4. **Provide the pilot's conformance-test results back to Apoorv and Martin** as they implement #1121 and #1595, so they can validate their emissions against pilot expectations.

5. **Establish an issue-labeling convention** in the pilot repo to flag issues that arrived from #1121 or #1595 (once operational) vs pilot-native issues, for observability.

### Acceptance criteria

- [ ] Coordination protocol documented and agreed by Apoorv, Martin, Carlos
- [ ] Weekly sync-check cadence established (e.g., 15 min in Apoorv's weekly technical meeting)
- [ ] Change-notification protocol in place with clear escalation paths
- [ ] Conformance test harness built with at least 5 real samples from Epic #826
- [ ] Similar conformance test harness for #1121 with sample SF TCR Cases
- [ ] Shared taxonomies (Sub Epic, Priority, Business Area) aligned between pilot and SFB team
- [ ] Pilot conformance-test results shared with #1121 and #1595 implementers as reference
- [ ] Issue-labeling convention for `matrix-origin` and `sfb-tcr-origin` documented
- [ ] `docs/way-of-work.md` §11 updated with the coordination protocol

### Hard constraints

- Coordination protocol respects Apoorv's weekly technical meeting cadence — do NOT introduce a new meeting
- Do NOT push implementation opinions to SFB team on their #1121 or #1595 — pilot is the consumer, not the architect
- Sample data used in conformance tests must be sanitized if it contains customer-identifying information (verify with Ingrid before committing)

### Depends on

US-062 (fields for conformance testing), US-063 (status taxonomy for status mapping tests), US-068 (Incident template for expected output).

### Priority rationale

P2 because it runs in parallel with US-072 and US-075 rather than gating them. But it's what makes those two stories durable — without coordination, conformance decays as #1121 and #1595 evolve.

### Ownership

Pilot-side responsibility: Carlos (protocol + test harness). SFB-side responsibility: Apoorv (#1121 alignment), Martin (#1595 alignment). Facilitation: Ingrid (Change Lead).
BODY_END

echo "  wrote 19 body files (E-11 + 18 stories)"
ls -1 "$BODY_DIR" | wc -l | xargs -I{} test {} -eq 19 || { echo "FAIL: body file count wrong"; exit 4; }

# ── issue creation phase ─────────────────────────────────────────────────────
# Parallel indexed arrays (bash 3.2 safe — no associative arrays)
STORY_IDS=""
STORY_IDS="$STORY_IDS US-062 US-063 US-064 US-065 US-066 US-067 US-068 US-069"
STORY_IDS="$STORY_IDS US-070 US-071 US-072 US-073 US-074 US-075 US-076 US-077 US-078 US-079"

# Story metadata as parallel positional arguments — mapped by loop index
STORY_TITLE_US062='[STORY] US-062: Add required GitHub Project fields (Priority, Size, Sprint, Type, Sub Epic, SFB Case Number, Business Area, Business Analyst, External References)'
STORY_LABELS_US062='story,phase:1,area:integration,effort:L,priority:P1'

STORY_TITLE_US063='[STORY] US-063: Adopt SFB status taxonomy (10 states per #1121)'
STORY_LABELS_US063='story,phase:1,area:integration,effort:M,priority:P1'

STORY_TITLE_US064='[STORY] US-064: Adopt 2-week sprint cadence with Plan / Continuous / Close phases'
STORY_LABELS_US064='story,phase:1,area:integration,effort:M,priority:P2'

STORY_TITLE_US065='[STORY] US-065: Document six-role taxonomy with per-initiative Change Lead binding'
STORY_LABELS_US065='story,phase:1,area:integration,effort:S,priority:P1'

STORY_TITLE_US066='[STORY] US-066: Wire checkpoint approvals to role-based routing'
STORY_LABELS_US066='story,phase:1,area:integration,effort:M,priority:P2'

STORY_TITLE_US067='[STORY] US-067: UAT-must-complete-before-prod gate wired into CP2->CP3 provenance'
STORY_LABELS_US067='story,phase:1,area:integration,effort:M,priority:P2'

STORY_TITLE_US068='[STORY] US-068: Three issue templates (Feature, Story/Task, Bug) with Sub Epic + required fields'
STORY_LABELS_US068='story,phase:1,area:integration,effort:M,priority:P1'

STORY_TITLE_US069='[STORY] US-069: Capture layer channel inventory rationalization (E-00 channel set vs Telenor reality)'
STORY_LABELS_US069='story,phase:1,area:capture,effort:S,priority:P2'

STORY_TITLE_US070='[STORY] US-070: docs/team-routing.yaml — named-person → business-area routing config'
STORY_LABELS_US070='story,phase:1,area:integration,effort:S,priority:P2'

STORY_TITLE_US071='[STORY] US-071: Scope-freeze rule in CLAUDE.md + provenance schema addition'
STORY_LABELS_US071='story,phase:1,area:governance,effort:S,priority:P1'

STORY_TITLE_US072='[STORY] US-072: SFB TCR schema conformance (consume upstream #1121)'
STORY_LABELS_US072='story,phase:1,area:integration,effort:S,priority:P1'

STORY_TITLE_US073='[STORY] US-073: Cross-dashboard navigation (GitHub Pages ↔ SF SFB Request Backlog)'
STORY_LABELS_US073='story,phase:1,area:visibility,effort:S,priority:P3'

STORY_TITLE_US074='[STORY] US-074: SFB-GitHub sync health KPI on pilot dashboard'
STORY_LABELS_US074='story,phase:1,area:visibility,effort:S,priority:P2'

STORY_TITLE_US075='[STORY] US-075: Matrix ↔ GitHub bidirectional sync via ServiceNow REST + Business Rules'
STORY_LABELS_US075='story,phase:1,area:integration,effort:S,priority:P1'

STORY_TITLE_US076='[STORY] US-076: Three-flow routing rules in CLAUDE.md and planner agent'
STORY_LABELS_US076='story,phase:1,area:integration,effort:M,priority:P2'

STORY_TITLE_US077='[STORY] US-077: Adoption risk register (R-TELENOR-CONCURRENT-MIGRATION, R-SERVICENOW-DEPENDENCY, R-SFB-COORDINATION)'
STORY_LABELS_US077='story,phase:1,area:governance,effort:S,priority:P2'

STORY_TITLE_US078='[STORY] US-078: Per-flow Phase 1 success metrics + key-person-risk KPI on dashboard'
STORY_LABELS_US078='story,phase:1,area:visibility,effort:M,priority:P2'

STORY_TITLE_US079='[STORY] US-079: SFB team coordination protocol for #1121 and #1595 conformance'
STORY_LABELS_US079='story,phase:1,area:integration,effort:M,priority:P2'

# ── helper: check if an issue exists by title-anchored search (rule 3) ───────
# Uses `in:title` qualifier — no free-text search.
issue_exists() {
  local id="$1"
  local found
  found=$(gh issue list -R "$REPO" --state all --search "$id in:title" --json number --jq '.[0].number // empty')
  if [ -n "$found" ]; then
    echo "$found"
  fi
}

# ── helper: verify issue exists after creation (rule 4) ──────────────────────
# Re-fetches and asserts the create actually took.
assert_issue_created() {
  local num="$1"
  local expected_title="$2"
  local actual_title
  # Small delay for GitHub to index the new issue
  sleep 1
  actual_title=$(gh issue view "$num" -R "$REPO" --json title --jq '.title' 2>/dev/null || true)
  if [ -z "$actual_title" ]; then
    echo "FAIL: issue #$num not found after creation"
    exit 5
  fi
  if [ "$actual_title" != "$expected_title" ]; then
    echo "FAIL: issue #$num has title '$actual_title', expected '$expected_title'"
    exit 5
  fi
}

# ── helper: link a story as native sub-issue of E-11 ─────────────────────────
# Uses -F (typed integer field) not -f, per empirical finding from US-051.
link_sub_issue() {
  local parent_num="$1"
  local child_num="$2"
  local child_id
  child_id=$(gh api "repos/$REPO/issues/$child_num" --jq '.id')
  gh api "repos/$REPO/issues/$parent_num/sub_issues" \
    -F sub_issue_id="$child_id" >/dev/null 2>&1 || {
    # sub_issues API may return 422 if already linked — non-fatal
    echo "  ~ sub-issue link ($child_num -> $parent_num) may already exist or failed; verify manually"
  }
}

# ── helper: add an issue URL to the project board (optional) ─────────────────
add_to_project() {
  local issue_url="$1"
  if [ "$ADD_TO_PROJECT" = "true" ]; then
    gh project item-add "$PROJECT_NUM" --owner "$PROJECT_OWNER" --url "$issue_url" >/dev/null 2>&1 \
      || echo "    WARN: failed to add $issue_url to project"
  fi
}

# ── create E-11 epic ─────────────────────────────────────────────────────────
echo ""
echo "→ Creating E-11 epic ..."

EPIC_NUM=$(issue_exists "E-11")
if [ -n "$EPIC_NUM" ]; then
  echo "  ~ E-11 already exists as #$EPIC_NUM (skipping)"
else
  EPIC_URL=$(gh issue create -R "$REPO" \
    --title "[EPIC] E-11: Telenor SFB DevOps Way-of-Work Integration" \
    --label "epic,phase:1,area:integration,priority:P1" \
    --milestone "$MILESTONE" \
    --body-file "$BODY_DIR/E-11.md")
  EPIC_NUM="${EPIC_URL##*/}"
  assert_issue_created "$EPIC_NUM" "[EPIC] E-11: Telenor SFB DevOps Way-of-Work Integration"
  add_to_project "$EPIC_URL"
  echo "  created E-11 as issue #$EPIC_NUM"
fi

# ── create each story and link as sub-issue ──────────────────────────────────
echo ""
echo "→ Creating stories US-062..US-079 ..."

for story_id in $STORY_IDS; do
  # Fetch title + labels via variable indirection (bash 3.2 safe)
  short_id="${story_id//-/}"  # US-062 -> US062
  title_var="STORY_TITLE_${short_id}"
  labels_var="STORY_LABELS_${short_id}"
  eval "story_title=\"\${$title_var}\""
  eval "story_labels=\"\${$labels_var}\""
  body_file="$BODY_DIR/$story_id.md"

  if [ ! -f "$body_file" ]; then
    echo "FAIL: body file for $story_id missing at $body_file"
    exit 6
  fi

  existing=$(issue_exists "$story_id")
  if [ -n "$existing" ]; then
    echo "  ~ $story_id already exists as #$existing (skipping create; verifying sub-issue link)"
    link_sub_issue "$EPIC_NUM" "$existing"
    continue
  fi

  story_url=$(gh issue create -R "$REPO" \
    --title "$story_title" \
    --label "$story_labels" \
    --milestone "$MILESTONE" \
    --body-file "$body_file")
  story_num="${story_url##*/}"
  assert_issue_created "$story_num" "$story_title"
  link_sub_issue "$EPIC_NUM" "$story_num"
  add_to_project "$story_url"
  echo "  created $story_id as issue #$story_num (sub-issue of E-11 #$EPIC_NUM)"
done

# ── verify final state ───────────────────────────────────────────────────────
echo ""
echo "→ Verifying final state ..."

final_e11=$(issue_exists "E-11")
if [ -z "$final_e11" ]; then
  echo "FAIL: E-11 epic not found after seed"
  exit 7
fi

story_count=0
missing=""
for story_id in $STORY_IDS; do
  found=$(issue_exists "$story_id")
  if [ -n "$found" ]; then
    story_count=$((story_count + 1))
  else
    missing="$missing $story_id"
  fi
done

if [ -n "$missing" ]; then
  echo "FAIL: missing stories after seed:$missing"
  exit 7
fi

echo "  E-11 (#$final_e11) + $story_count stories present"

sub_issue_count=$(gh api "repos/$REPO/issues/$final_e11/sub_issues" --jq 'length' 2>/dev/null || echo 0)
echo "  E-11 has $sub_issue_count native sub-issues (expected 18)"

echo ""
echo "✓ E-11 seeding complete."
echo "  Epic: #$final_e11"
echo "  Stories: $story_count of 18"
echo "  Sub-issues linked: $sub_issue_count"
echo ""
echo "Next steps:"
echo "  1. Review the seeded issues in GitHub UI"
echo "  2. Commit this seeder to tools/create-e11-issues.sh per US-061 pattern"
echo "  3. Begin implementation from foundation stories: US-062, US-065, US-071"
