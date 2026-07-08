# Agentic SDLC Pilot — Status & Next Steps

**Prepared:** 2026-07-07 · **Audience:** SFB team (Ingrid, Apoorv, Martin) + Carlos
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
needs the team.** *(Integration backlog E-11: 6 of 18 stories done; 2 in review
pending Ingrid; the rest are the coordination items below.)*

## What we need — by person

### 👤 Ingrid (Change Lead / Release Manager) — two quick reviews unblock two items
1. **Team-routing config** ([PR #136](https://github.com/carloshumbertoreyesortiz/agentic-sdlc-pilot/pull/136)): confirm the Business Analysts' GitHub handles, and assign a BA to the **7 business areas** we could not map from the workshop — Telesales, Small / Medium Enterprises, Customer Onboarding, Technical Onboarding, E-Commerce, UC & Cloud, Mobile Order and Delivery.
2. **Cross-dashboard link** ([PR #137](https://github.com/carloshumbertoreyesortiz/agentic-sdlc-pilot/pull/137)): confirm the exact URL of the Salesforce "SFB Request Backlog" dashboard (id `01ZdV000000uD2bUAE`).

### 👤 Apoorv (Technical Lead; owner of #1121, SF ↔ GitHub sync)
3. Share the **exact field + status mapping** #1121 will emit, so the pilot can finish **US-072** (schema *conformance* — a small verification; you own the actual sync, the pilot just receives it cleanly).
4. Agree a **weekly 15-min sync-check** (in your existing technical meeting) so the two schemas don't drift — this is **US-079**.

### 👤 Martin (owner of #1595, Matrix ↔ GitHub sync) — *the critical path*
5. Share the **Matrix #1595 field mapping**, and
6. **Kick off the ServiceNow "Authorized Incident Reporter" (AIR) service-account request** (per KB0010037). This gates **US-075** — the **Matrix ↔ GitHub sync**, which Ingrid flagged as the **highest-value, most person-dependent** task today (currently all manual, resting on her alone).

### 👤 Carlos (pilot lead)
7. Create the **Sprint** field in the Project (the one field the automation could not add) — **US-064**.
8. Merge **#136 / #137** once Ingrid signs off.
9. Schedule the **status migration** of existing issues to the 10-state model — a deliberate, reversible pass (not automatic).

## The critical path (one sentence)

The single most valuable next step — **automating Ingrid's manual Matrix sync
(US-075)** — is blocked on **Martin sharing #1595's mapping** and the
**ServiceNow AIR service account**. Everything else is smaller and can proceed
in parallel.

## Once unblocked, the pilot will

Finish US-072 (SF conformance) and US-075 (Matrix conformance), wire role-based
checkpoint approvals (US-066), the UAT-before-production gate (US-067), and
per-flow success metrics (US-078) — completing the E-11 integration backlog.

---

_This file is a point-in-time handoff. The live delivery view is the [Pages
dashboard](https://carloshumbertoreyesortiz.github.io/agentic-sdlc-pilot/); the
authoritative process is [docs/way-of-work.md](way-of-work.md)._
