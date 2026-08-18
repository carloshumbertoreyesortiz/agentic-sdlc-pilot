# Matrix incident → GitHub issue — the field-mapping contract

_From: Carlos Reyes + Claude Code · 18 August 2026 · **DRAFT for Martin, Isak and Ingrid to confirm** (Step 3)_
_Companion to [technical-next-steps-matrix-sync.md](technical-next-steps-matrix-sync.md) · pilot story US-075 · schema per [way-of-work.md](way-of-work.md) §6, §7_

## Why this document exists

ServiceNow calls GitHub's REST API **directly** — there is no pilot-hosted receiver in the path (see Step 4). So the mapping is not code the pilot runs; it is a **contract the ServiceNow job implements**. Without it written down, the sending side gets built against an invented payload shape and the issue schema rejects it.

This is a **draft to react to**, not a decision already taken. Every row is open to correction at the mapping session — the point is that a 30-minute session spent editing a table finishes in 30 minutes, and one spent filling a blank page does not.

`src/matrix-mapping.ts` is the executable form of this document, with tests. It is **reference documentation, not a runtime component** — it exists so the contract is unambiguous and so Step 5's dry-run can diff expected against actual.

## 1. Field mapping

| ServiceNow incident field | GitHub issue | Notes |
| --- | --- | --- |
| `sys_id` | Body — `Matrix-Sys-Id:` line, and the **match key** | Globally unique. The multi-instance `INC` collision Halvor raised makes this the only safe key. Never shown to humans as the identifier. |
| `number` (`INC…`) | Title prefix + External References `Reference Id` | Human-readable label only. |
| `short_description` | **Title** (after the `INC…` prefix) | Truncated to keep the title under 200 chars; full text always present in the body. |
| `description` | Body — **Background** section | Verbatim. |
| `priority` | **Priority** field | See §2. |
| `state` | **Status** field | See §3. |
| `caller_id` | **Caller** field | Required on Type = Incident per way-of-work §6. |
| `assigned_to` | Body — Assigned (informational) | *Not* mapped to GitHub assignee — GitHub usernames and ServiceNow users are different identity spaces, and a bad guess silently misassigns work. Revisit only if a reliable mapping exists. |
| `opened_at` | Body — Raised (informational) | GitHub's own `created_at` records when the *issue* appeared, which is a different fact. |
| `sys_updated_on` | Body — Source last updated | Lets the daily full-scope run detect drift without a GitHub-side store. |
| work notes (journal) | Issue comments, prefixed `**[Matrix work note]**` | Direction and visibility rules in §4. |
| — | **Type = Incident** | Fixed for every record from this flow. |
| — | **Sub Epic = Matrix Defect** | Fixed. Pilot-side addition for US-075 output (way-of-work §6). |
| — | Label `matrix` | Makes the whole flow filterable in one query. |
| — | External References record | `Reference Type = Matrix`, `Reference Id = INC…`, `Reference URL` = deep link. Mechanism established by #1121, adopted verbatim. |
| ← `correlation_id` | GitHub issue **number** | Written back by ServiceNow from GitHub's response. |
| ← `correlation_display` | GitHub issue **URL** | As above. |

**Open — needs Martin:** `category` / `subcategory` / `assignment_group` are not mapped yet because their value lists aren't known on the pilot side. If any of them should drive Sub Epic or a label, that's a mapping-session decision.

## 2. Priority

ServiceNow priority is computed from impact × urgency and is numeric; the pilot's Priority field follows #1121's P-scale.

| ServiceNow | GitHub | |
| --- | --- | --- |
| 1 — Critical | P1 | |
| 2 — High | P1 | Deliberate collapse — see below |
| 3 — Moderate | P2 | |
| 4 — Low | P3 | |
| 5 — Planning | P4 | |

⚠️ **This collapse is a proposal, not a fact.** Five ServiceNow levels into four P-values loses information, and I have picked 1+2 → P1 because both are "drop what you are doing" in practice. **Ingrid should confirm** — she has been making this judgement by hand and may map them differently. If the distinction matters, the alternative is 2 → P2 and shifting the rest down.

## 3. State → Status

Mapping into the 10-state SFB taxonomy (way-of-work §5, US-063). Status flows **ServiceNow → GitHub** as the direction of truth for incoming records.

| ServiceNow state | GitHub Status |
| --- | --- |
| New | Backlog |
| In Progress | Development |
| On Hold / Pending | Pending Requestor |
| Resolved | Deployed |
| Closed | Done |
| Cancelled | *(close the issue as not planned)* |

⚠️ **Resolved → Deployed is the weakest row here.** In ServiceNow "resolved" means the handler believes it is fixed; in the SFB taxonomy "Deployed" means the change reached production. Those are not the same claim, and Isak's closure semantics may well separate them. Flagged for the session rather than quietly assumed.

## 4. Work notes and comments

Confirmed by Halvor (2026-08-14): **comments are visible to the caller; work notes are for case handlers.**

- **Inbound (Matrix → GitHub): both**, each labelled with its origin so they can never be confused. A caller's comment is frequently the detail that explains the defect, so dropping it degrades triage.
- **Outbound (GitHub → Matrix): work notes only.** Automated engineering progress is internal and must not surface to the caller. Halvor concurs: _"if it's strictly internal it should be work notes."_
- **Hard requirement:** an inbound work note must never be echoed back into anything caller-visible. The origin prefix is what makes this checkable.

**Pending Isak's confirmation** — he owns note-handling and closure semantics.

## 5. The exact call

### Create — `POST https://api.github.com/repos/{owner}/{repo}/issues`

```http
Authorization: Bearer <token>
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
```

```json
{
  "title": "INC0012345 — Quote PDF fails to generate for CPQ orders",
  "labels": ["matrix", "incident"],
  "body": "## Background\n\nWhen a sales agent completes a CPQ order the quote PDF fails to render and the agent sees a generic error.\n\n## Source\n\n| | |\n|---|---|\n| Matrix incident | [INC0012345](https://matrix.telenor.no/nav_to.do?uri=incident.do?sys_id=a1b2c3d4e5f6) |\n| Caller | Nina Jakobsen |\n| Assigned (Matrix) | Erik Lauvli |\n| Raised | 2026-08-18T09:14:00Z |\n| Source last updated | 2026-08-18T11:02:00Z |\n\n<!-- Matrix-Sys-Id: a1b2c3d4e5f6 -->\n_Synced from Matrix by the SFB integration. Do not edit the Source table by hand._"
}
```

**Read from the response:** `number` → `correlation_id`, `html_url` → `correlation_display`.

The `sys_id` goes in an **HTML comment** so it is invisible when rendered but still searchable and machine-readable. Being in the body rather than a label means no label-length limits and no accidental deletion by a well-meaning triager.

### Search before create — the duplicate guard

Run this **first**, every time. Create only if `total_count` is `0`:

```
GET https://api.github.com/search/issues?q=repo:{owner}/{repo}+in:body+"Matrix-Sys-Id:+{sys_id}"+is:issue
```

This replaces the idempotency key originally proposed: GitHub's API has no idempotency mechanism, and with no receiver there is nothing to honour one. Search-before-create is SN-side, needs nothing from GitHub, and self-heals the exact failure the key was for — a request that succeeded while its response was lost.

⚠️ **Search indexing lags writes by seconds.** Two runs in quick succession can both see zero results. Mitigations, in order: rely on the queue processing one record at a time per incident (§ ordering ask); and treat `correlation_id` already being populated on the incident as the first check, before searching GitHub at all — that one is immediate and local.

### Update — `PATCH /repos/{owner}/{repo}/issues/{number}`

Use the `number` from `correlation_id`. Send only changed fields.

### Add a work note as a comment — `POST /repos/{owner}/{repo}/issues/{number}/comments`

```json
{ "body": "**[Matrix work note]** — Erik Lauvli, 2026-08-18T11:02:00Z\n\nReproduced on the test environment; appears to be the template lookup." }
```

## 6. What is still open

| Question | Owner | Blocks |
| --- | --- | --- |
| Which incidents are in scope (the encoded query) | **Ingrid** — her manual selection is the specification | The whole job — Halvor cannot finish the query without it |
| Priority collapse (1+2 → P1?) | Ingrid | §2 |
| Resolved → Deployed, or something else | Isak | §3 |
| Work notes / comments confirmation | Isak | §4 |
| `category` / `assignment_group` → Sub Epic or labels | Martin | §1 |
| Title length and prefix convention | Any | Cosmetic; defaulted above |
