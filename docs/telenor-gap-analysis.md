# Telenor SFB Way-of-Work — Gap Analysis (Phase 1 Discovery)

**Prepared for:** Architecture Rev 1.7 + E-11 backlog seeding · **Status:** DRAFT for review
**Date:** 2026-06-30 · **Repo:** [carloshumbertoreyesortiz/agentic-sdlc-pilot](https://github.com/carloshumbertoreyesortiz/agentic-sdlc-pilot)
**Author:** Claude Code (read-only discovery — no schema/label/issue mutations performed)
**Amended:** 2026-07-01 — incorporates Ingrid Marie Urdshals's 2026-06-30 reply (§3 role taxonomy **CONFIRMED**, §4 Flow C **CONFIRMED**; §7 US-072 phasing remains provisional).

> **Scope.** This is a read-only discovery report comparing the current pilot
> state (verified live from the repo on 2026-06-30) against the Telenor SFB
> way-of-work described in the Sprint_Planning Confluence page, the Workshop #1
> deck, and the Release Manager 2026-06-30 email. It files no issues, changes no
> labels/fields, and mutates no schema. Proposed stories (US-062–US-075) are
> **references only** — the authoritative scope/numbering comes from the Rev 1.2
> backlog (architecture deliverable, not yet in hand).

**Evidence legend**
- ✅ **Verified** — read live from this repo (Issues API, Project board, docs, source).
- 📄 **Given** — sourced from the Telenor inputs (Confluence / Workshop #1 / RM email); authoritative per Carlos, not independently verifiable from this environment.
- ⏳ **Provisional** — one item remains after Ingrid's 2026-06-30 reply: **§7 US-072 phasing** (Phase 1 vs 2). The role-taxonomy question is now **CONFIRMED** (§3). Marked inline; finalised before merge.

---

## §1 Required fields (Telenor spec vs current state)

📄 Telenor-required GitHub issue fields per the **Sprint_Planning** Confluence
page: **Priority, Size, Sprint, Label, Type, SFB Case Number**.
📄 Workshop #1 **Slide 6** adds: **Business Area**.

✅ Current state: the pilot has **no custom Project fields** — the board (user
Project #1 "Agentic SDLC Pilot — Phase 0/1") carries only stock ProjectV2
fields. Categorisation today is done with **labels** and the default **Status**
single-select. (58 items on the board vs 72 issues in the repo — ~14 newer
issues are not yet added to the board.)

| Telenor field | Present today? | How implemented (current) | Gap |
|---|---|---|---|
| **Priority** | ⚠️ Partial | Labels `priority:P0–P3` (✅ usage: P1×17, P2×34, P3×6, **P0×0**). Not a board field; not enforced; newer issues drift (e.g. #103 has no priority). | Promote to a board single-select field; backfill; retire the unused/!default split. |
| **Size** | ⚠️ Partial | Labels `effort:S/M/L` (✅ S×27, M×27, L×7). Named "effort" not "Size"; **no XL**; story points also live free-text in issue bodies (`(N pts)`). | Reconcile to a single "Size" field with the Telenor scale; resolve effort-vs-points duplication. |
| **Sprint** | ❌ No | No iteration/sprint field or label anywhere; the board has no `Iteration` field. | Add a Sprint/Iteration field (see §5). |
| **Label** | ✅ Yes | Native GitHub labels — a rich governance taxonomy (epic/story, phase:*, area:*, effort:*, priority:*, blocked). | None for the generic field; but the taxonomy overloads "Label" to carry Type/Priority/Size/Phase (see those rows). |
| **Type** | ⚠️ Partial | Only `epic`/`story` labels (✅ 11 epics / 61 stories). No Bug/Spike/Task/Change type; GitHub native Issue Types not used (stock `bug`/`enhancement`/etc. labels exist but have **0 usage**). | Define a Type taxonomy/field; wire to issue templates (§ templates). |
| **SFB Case Number** | ❌ No | No field, label, or body convention linking a GitHub issue to a Salesforce TCR Case. | Add SFB Case Number field; populate via Flow B / US-072 (§4, §7). |
| **Business Area** | ❌ No | No field or label. | Add Business Area field (📄 Slide 6). |

**Summary:** of 7 Telenor-required fields, **1 fully present** (Label), **3
partial-via-labels** (Priority, Size, Type), **3 absent** (Sprint, SFB Case
Number, Business Area). None exist as first-class **board fields** — the
migration from labels→fields is the core of US-062 (Project-admin work).

---

## §2 Status taxonomy (Telenor spec vs current state)

📄 Telenor lifecycle (7 states): **Draft → Backlog → Ready for Development → In
Active Sprint → Ready for Deployment → Deployed → Done**.

✅ Current: effectively **open/closed binary**, plus milestone grouping (= phase,
not status), plus the board **Status** single-select with **4 values**:
`Todo · In Progress · Blocked · Done`.

| Telenor state | Closest current representation | Gap |
|---|---|---|
| Draft | — (no pre-backlog state) | No "Draft": issues are created already-triaged. |
| Backlog | `Todo` (board) / open + milestone | Conflated with "Ready for Development". |
| Ready for Development | `Todo` (board) | No explicit readiness gate. |
| In Active Sprint | `In Progress` (board) | No sprint binding (no Sprint field, §5). |
| Ready for Deployment | — | **Absent** — pilot tracks no deployment-readiness state. |
| Deployed | — | **Absent** — no deployment-stage tracking; "Done" = issue closed. |
| Done | `Done` (board) / CLOSED | Present, but conflates "Deployed" and "Done". |
| (orthogonal) | `Blocked` (board) + `blocked` label (✅ ×1) | Telenor models blocked as a flag, not a lifecycle state — current matches. |

**Summary:** current 4-state board maps to ~3 of the 7 Telenor states; the two
**deployment-stage states (Ready for Deployment, Deployed)** and the **Draft**
pre-state are entirely unrepresented. Status adoption is US-063 (CLAUDE.md/doc
now; field changes ride on US-062 Project-admin work).

---

## §3 Role taxonomy

📄 **CONFIRMED** (Ingrid Marie Urdshals, 2026-06-30 reply). Workshop #1
**Slides 4–5** define **six** roles and **no distinct seventh**: the workshop's
*"Other Roles Needed?"* item concluded with **no additions**. The **Release
Manager** responsibility maps onto **Change Lead** — it is *not* a separate role.

Two clarifications from the reply:
- **Change Lead is per-initiative, not a fixed person.** **Ingrid Marie
  Urdshals** holds Change Lead for **SFB-originated** requests; other initiatives
  have their own Change Leads.
- **Technical Lead is Apoorv** (runs the weekly technical meetings,
  cross-developer coordination).

✅ Current pilot is still **solo-operated** (Carlos fills every seat locally);
the identities below are the Telenor-side owners the pilot must eventually map
onto. Agentic checkpoints: **CP1** = plan approval (CLAUDE.md plan-first /
`/plan`, Checkpoint 1); **CP2** = PR review + the two required gates (`check`,
`agent-provenance`); **CP3** = deploy/closure approval (E-09 Slack deploy flow,
scaffold/dormant).

| Telenor role | Confirmed identity / binding | Checkpoint ownership | Gap |
|---|---|---|---|
| Business Analyst | per-initiative (frames requirement) | contributes to **CP1** | Role not named in repo governance. |
| Administrator | SF / Project-board admin | field & board hygiene (no gate) | SF-admin duties out of pilot scope. |
| Developer | Accenture developers + Claude Code (agent) | authors work reviewed at **CP2** | Agent-as-developer encoded; human dev role implicit. |
| **Change Lead** | **Per-initiative** — **Ingrid M. Urdshals** for SFB | **owns CP1**; **CP3 joint — final closure authority** | Not encoded; CP1/CP3 currently collapsed to the solo operator. |
| **Technical Lead** | **Apoorv** (weekly tech mtgs, cross-dev coordination) | **owns CP2**; **CP3 joint** | Not separated from the reviewer role today. |
| Initiative Lead | per-initiative (prioritises initiatives) | portfolio input to **CP1** | No portfolio/initiative layer. |

**Summary:** six confirmed roles, no seventh; Release Manager = Change Lead.
Checkpoint ownership is now definite — **CP1: Change Lead** (per-initiative),
**CP2: Technical Lead** (Apoorv today), **CP3: Change Lead + Technical Lead
jointly, Change Lead as final closure authority.** None of this is yet encoded
in the repo's governance (the pilot collapses all seats to one operator) — that
mapping is the remaining gap (GAP-09/09a), no longer blocked on an open question.

---

## §4 Three intake flows (revised per RM 2026-06-30 email)

📄 The RM email replaces the earlier two-flow model with **three** flows:

**Flow A — Larger initiatives via meetings/dialogue.** 📄 Captured by E-00
channels (email names Teams/Slack/Confluence/Outlook).
✅ **Verified current state: 0 of 6 E-00 channels are operational.**
- E-00 stories **US-052–US-059 (#90–#97) are all OPEN**, including US-052 (the
  `NormalizedIntake` schema itself) — the intake plumbing is designed but not
  built.
- **Slack** is the only channel with substance: US-038 (#48, app registration)
  is closed and `src/slack/bot.ts` logic is built + tested, **but `docs/slack.md`
  states it is "scaffold/dormant — does not connect to Slack yet,"** and the
  real intake handler US-054 (#92) is open and *supersedes* US-038.
- ⚠️ **Channel-set mismatch:** the architecture's E-00 six channels are
  **Teams / Slack / Confluence / Jira / VS Code / CLI**. The email's Flow A names
  **Outlook** (not in the architecture) and omits Jira / VS Code / CLI. The
  self-serve pair (VS Code, CLI) — the channels usable without admin tickets —
  is absent from the email's framing.

**Flow B — End-user requirements via SFB TCR Case in Salesforce.** 📄 Today:
manual GitHub issue creation from a TCR Case. ✅ No SFB Case Number field or
sync exists (§1, §7). 📄 US-072 will automate.

**Flow C — Defects via Matrix.** 📄 **CONFIRMED** (Ingrid Marie Urdshals,
2026-06-30 reply):
- **Matrix = Telenor's local ServiceNow instance** at **matrix.telenor.no**.
- Access is controlled via the **"Authorized Incident Reporter (AIR)"** role,
  requested per **KB0010037**.
- **Current state** (from Ingrid's email; not repo-verifiable): **Accenture
  developers lack Matrix access.** Ingrid **manually creates a GitHub issue for
  each new Matrix incident** and **manually updates Matrix** from GitHub
  progress — **bidirectional manual toil** borne by a named stakeholder.
- **US-075 design implication:** the integration pattern is a **ServiceNow
  Business Rule → GitHub webhook**. ServiceNow's mature REST API drops US-075
  from **XL → L** effort.
- **Scope note:** US-075 must cover **both Matrix → GitHub and GitHub → Matrix
  status sync.** Ingrid's workaround is bidirectional; a one-directional US-075
  would eliminate only half her toil.

**Summary:** the pilot operates **only as Flow A, and only nominally** (design
complete, 0 channels live); **Flow B is fully manual**; **Flow C has no
integration** — it is Ingrid's bidirectional manual toil today. The "(partially
captured)" characterisation overstates today's state — nothing is captured
through E-00 yet.

---

## §5 Sprint cadence

📄 Telenor: **2-week sprints** with **Plan / Create–Review–Release (continuous)
/ Close**.

✅ Current: **no sprint structure.** No Sprint/Iteration field (§1); milestones
are **phases** (Phase 0/1/2), not sprints — all three are open, grouping by
delivery stage not time-box. No sprint ceremonies, no Plan/Close cadence encoded.
Work flows continuously through `agent/*` PRs gated by `check` +
`agent-provenance`.

**Gap:** introduce a Sprint/Iteration field and a 2-week cadence; map the
continuous "Create–Review–Release" loop (which the agentic pipeline already
embodies) onto the Telenor sprint frame without losing continuous flow.

---

## §6 Scope-freeze rule

📄 Workshop #1 **Slide 11**: *"Only functionality agreed upon during Create and
Review is relevant for confirmation. New requirements = new tickets."*

✅ Current: **not encoded in CLAUDE.md.** The closest existing rule is the
hard-rule **"Stay in scope — do only what the approved plan covers; surface
anything beyond it instead of silently expanding,"** which is a per-task scope
discipline, **not** the Telenor scope-freeze-at-confirmation rule (no notion of
Create/Review freezing the confirmable surface, no "new requirement → new
ticket" directive).

**Gap:** add the scope-freeze rule to CLAUDE.md and (per US-071) to the
provenance schema so confirmation is auditable. Documentation-only; CC-doable.

---

## §7 SFB Case → GitHub auto-sync ⏳ PROVISIONAL

📄 Per the RM email, the SFB TCR Case → GitHub issue link (Flow B) is **manual
today** and is the automation target of **US-072**.

✅ Current: no SFB Case Number field, no Salesforce↔GitHub sync, no webhook —
fully manual.

⏳ **Provisional:** whether US-072 lands in **Phase 1 or Phase 2** is still open.
This affects §10 sequencing and whether the SFB Case Number field (US-062) is
required earlier. **Note:** US-072 phasing is pending Carlos's follow-up ping to
Ingrid (2026-06-30) — Ingrid's first reply did not settle it.

---

## §8 Three-way concurrent migration (adoption risk)

📄 Workshop #1 **Slide 8**: the SFB team is simultaneously migrating
**Jira → GitHub**, **Salesforce Change Sets → Git / DevOps Center**, and
**adopting the agentic pilot** — three concurrent platform migrations.

✅ Current: `docs/risks.md` registers R-01–R-05; **no concurrent-migration risk
is recorded.**

**Gap / action:** add **R-TELENOR-CONCURRENT-MIGRATION** (adoption risk: three
simultaneous migrations compound change-fatigue and rollback complexity) to
`docs/risks.md`. 📄 Per the plan, Carlos adds this in **architecture Rev 1.7** —
flagged here, **not** added by this PR (read-only discovery).

---

## §9 Cross-dashboard navigation

📄 An existing Telenor **Salesforce dashboard "SFB Request Backlog"** lives at SF
Dashboard ID **`01ZdV000000uD2bUAE`**. 📄 Future state: the GitHub Pages
dashboard links to it (and possibly vice-versa).

✅ Current: the GitHub Pages dashboard exists and is live
(https://carloshumbertoreyesortiz.github.io/agentic-sdlc-pilot/, generated at
deploy time as of US-051) but has **no cross-link** to the SF dashboard; the SF
side has no link back.

**Gap:** add bidirectional cross-dashboard navigation so a viewer can pivot
between the SF SFB Request Backlog and the GitHub delivery dashboard.

---

## §10 Summary table

> Gap-ids are local to this report. Proposed stories are **references only**
> (US-062–US-075); exact numbering/scope is confirmed by the Rev 1.2 backlog.
> "Proposed" stories beyond the prompt-anchored ones (US-062/063/068/071/072/075)
> are best-fit placeholders pending Rev 1.2.

| Gap-id | Area | Current state | Telenor target state | Proposed story |
|---|---|---|---|---|
| GAP-01 | Fields: Priority | Label `priority:P0–P3`, not a field, drifting | First-class Priority field, enforced | US-062 |
| GAP-02 | Fields: Size | Label `effort:S/M/L` + body points, no XL | Single Size field, Telenor scale | US-062 |
| GAP-03 | Fields: Sprint | Absent | Sprint/Iteration field | US-062 + US-064 (proposed) |
| GAP-04 | Fields: Type | `epic`/`story` labels only | Type taxonomy (Story/Bug/Spike/Change…) | US-062 + US-068 |
| GAP-05 | Fields: SFB Case Number | Absent | SFB Case Number field | US-062 (field) + US-072 (sync) |
| GAP-06 | Fields: Business Area | Absent | Business Area field (Slide 6) | US-062 |
| GAP-07 | Status taxonomy | 4-value board (Todo/In Progress/Blocked/Done) | 7-state lifecycle | US-063 |
| GAP-08 | Deployment states | None (Done = closed) | Ready for Deployment, Deployed | US-063 |
| GAP-09 | Roles | Solo-operated; roles not encoded | **6** roles → CP1/CP2/CP3 (no 7th; Release Mgr = Change Lead) | US-066 (proposed) |
| GAP-09a | Roles: Change Lead binding | Not encoded | **Per-initiative** Change Lead (Ingrid for SFB); owns CP1 + CP3 final-closure authority | US-066 (proposed) |
| GAP-10 | Intake Flow A | E-00 designed, 0/6 channels live; Slack dormant | Operational capture channels | E-00 (US-052–059) |
| GAP-11 | Intake Flow B | Manual TCR Case → issue | Automated SFB sync | US-072 ⏳ phase |
| GAP-12 | Intake Flow C | Matrix (ServiceNow) — manual **bidirectional** toil (Ingrid); Accenture devs lack access | **Bidirectional** Matrix↔GitHub sync (ServiceNow Business Rule → webhook) | US-075 (**effort L**, was XL) |
| GAP-13 | Sprint cadence | None (milestones = phases) | 2-week sprints, Plan/Close | US-064 (proposed) |
| GAP-14 | Scope-freeze rule | Not in CLAUDE.md ("stay in scope" only) | Scope-freeze at confirmation + new-ticket rule | US-071 |
| GAP-15 | Concurrent-migration risk | Not in risks.md | R-TELENOR-CONCURRENT-MIGRATION registered | Carlos / Rev 1.7 (not a CC story) |
| GAP-16 | Cross-dashboard nav | Pages dashboard, no cross-link | Bidirectional SF ↔ GitHub links | US-073 (proposed) |
| GAP-17 | Issue templates | None in `.github/ISSUE_TEMPLATE/` | Three templates (Type/fields enforced) | US-068 |
| GAP-18 | Board coverage | 58/72 issues on board | All issues on board | US-062 (migration) |

---

### Open questions blocking finalisation (⏳)
1. ~~**Release Manager** — distinct 7th role, or overlap with Change Lead? (§3)~~ **RESOLVED** 2026-06-30 (Ingrid): no 7th role; Release Manager = Change Lead (§3).
2. **US-072 SFB auto-sync** — Phase 1 or Phase 2? (§7, GAP-11) — still open, pending Carlos's follow-up ping to Ingrid.

### Explicitly out of scope for this report
No issues filed, no labels/fields/status changed, no schema mutated, no CLAUDE.md
edits. Existing-backlog migration to the new schema (US-062/US-063 implementation)
requires Project-admin permissions and a Carlos-mediated migration plan with
rollback — **not** part of discovery.
