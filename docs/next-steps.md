# Agentic SDLC Pilot — Status & Next Steps

**Prepared:** 2026-07-07 · **Updated:** 2026-08-04 · **Audience:** SFB team (Ingrid, Apoorv, Martin) + Carlos
**Companion:** [docs/way-of-work.md](way-of-work.md) (the full process), [docs/telenor-gap-analysis.md](telenor-gap-analysis.md) (how we got here)

## Where we are

The pilot has **adopted the SFB team's way of working** inside GitHub — it does
not invent a parallel process. The GitHub Project and repo now mirror how SFB
actually operates:

- ✅ **Issue fields** match SFB practice — Priority, Size, Type, **Sub Epic**,
  **SFB Case Number**, Business Area, Business Analyst, **External References**,
  plus **Caller / Alternate Contact** for Matrix incidents. *(12 fields, live on
  the board — US-062.)*
- ✅ **Status taxonomy** is the full **10-state SFB model** (Draft → Backlog →
  Ready for Development → Analysis → Development → User Acceptance Test → Ready
  for Deployment → Pending Requestor → Deployed → Done). *(Live; the old
  statuses are kept so nothing in flight breaks — US-063.)*
- ✅ **Issue templates** for Feature / Story / Task / Bug / **Incident** (the
  Incident template mirrors Matrix) — US-068.
- ✅ **Process documented** in one place (`docs/way-of-work.md`): three intake
  flows, six roles, 2-week sprint cadence, scope-freeze rule, adoption risks.
- ✅ **The planner** shapes its output per flow — full planning for initiatives,
  light verification for SFB cases, triage for Matrix defects (US-076).

**The pilot has now done everything it can do on its own. The remaining work
needs the team.** *(Integration backlog E-11: **12 of 18 stories done**; the
remaining six — US-064, US-072, US-074, US-075, US-078, US-079 — are the
coordination and access items below.)*

## What we need — by person

### 👤 Ingrid (Change Lead / Release Manager)
1. **Point us at the base-access sponsor.** Matrix does not load for Carlos at all — the site *and* the service-catalog request page are unreachable, so the pilot cannot even raise the requests that follow. This is an **ordinary end-user access request needing a sponsor** (Halvor or Julie, or whoever ServiceNow governance names) — it needs no admin rights and should **not** wait for the Matrix-team session. Tracked as `R-MATRIX-BASE-ACCESS`.
2. **The Matrix working session** — invite sent by Carlos on 2026-08-04. Suggested attendees: **Martin** (#1595 field mapping), **Isak Charrad** (incident note-handling + closure semantics), and whoever on the Matrix/ServiceNow side owns integration users. 30 minutes; [`docs/technical-next-steps-matrix-sync.md`](technical-next-steps-matrix-sync.md) is the pre-read.

_Done since the last revision: team-routing config ([PR #136](https://github.com/carloshumbertoreyesortiz/agentic-sdlc-pilot/pull/136)) and the cross-dashboard link ([PR #137](https://github.com/carloshumbertoreyesortiz/agentic-sdlc-pilot/pull/137)) — both confirmed by Ingrid and merged 2026-07-08._

### 👤 Apoorv (Technical Lead; owner of #1121, SF ↔ GitHub sync)
3. Share the **exact field + status mapping** #1121 will emit, so the pilot can finish **US-072** (schema *conformance* — a small verification; you own the actual sync, the pilot just receives it cleanly).
4. Agree a **weekly 15-min sync-check** (in your existing technical meeting) so the two schemas don't drift — this is **US-079**.

### 👤 Martin (owner of #1595, Matrix ↔ GitHub sync) — *the critical path*
5. Share the **Matrix #1595 field mapping** — how a Matrix incident maps to a GitHub issue (fields, statuses, note-forwarding rules), and
6. Join the **working session** to agree the **dedicated integration user + custom Scripted REST endpoint** on the ServiceNow side. This gates **US-075** — the **Matrix ↔ GitHub sync**, which Ingrid flagged as the **highest-value, most person-dependent** task today (currently all manual, resting on her alone).

   > **Correction (2026-08-04):** earlier revisions of this doc asked for the **"Authorized Incident Reporter" (AIR) role** per KB0010037. The ServiceNow contact confirmed that **AIR is an end-user role for humans reporting incidents — the wrong fit for a system-to-system integration**. The ask is now a **dedicated non-personal integration user**, web-service-access-only, with a **custom Scripted REST endpoint and its own custom role** scoped to the pilot's incidents + work notes (OAuth preferred, basic auth fallback). No self-service template exists — it is set up collaboratively, with **Carlos / the pilot as the accountable system owner**. Details in [`docs/technical-next-steps-matrix-sync.md`](technical-next-steps-matrix-sync.md) Step 1b.

### 👤 Carlos (pilot lead)
7. Create the **Sprint** field in the Project (the one field the automation could not add) — **US-064**.
8. Chase the **base-access sponsor** in parallel with the working session — the two asks must not be bundled (`R-MATRIX-BASE-ACCESS`).
9. Keep [`docs/technical-next-steps-matrix-sync.md`](technical-next-steps-matrix-sync.md) current as the session's pre-read, so Isak and the Matrix team can review async.

_Done since the last revision: **#136 / #137** merged (2026-07-08); the **status migration** to the 10-state SFB model executed, with pre-migration snapshots committed as audit artifacts under [`docs/migrations/`](migrations/) — US-063 closed._

## The critical path (one sentence)

The single most valuable next step — **automating Ingrid's manual Matrix sync
(US-075)** — is blocked first on **base Matrix access for Carlos** (the site and
service catalog do not load at all), then on the **working session** that agrees
the integration user, the REST endpoint, and Martin's #1595 field mapping.
Everything else is smaller and can proceed in parallel.

## Once unblocked, the pilot will

Finish US-072 (SF conformance) and US-075 (Matrix conformance), wire role-based
checkpoint approvals (US-066), the UAT-before-production gate (US-067), and
per-flow success metrics (US-078) — completing the E-11 integration backlog.

---

_This file is a point-in-time handoff. The live delivery view is the [Pages
dashboard](https://carloshumbertoreyesortiz.github.io/agentic-sdlc-pilot/); the
authoritative process is [docs/way-of-work.md](way-of-work.md)._
