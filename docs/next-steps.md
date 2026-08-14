# Agentic SDLC Pilot — Status & Next Steps

**Prepared:** 2026-07-07 · **Updated:** 2026-08-10 · **Audience:** SFB team (Ingrid, Apoorv, Martin) + Carlos
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
1. **Which incidents do you sync by hand?** Your manual selection *is* the specification for what the automation should pick up. Walking through a handful of the incidents you recently turned into GitHub issues lets us derive the scope filter from evidence. Note the anchor is the **affected system** (the SFB Salesforce application), not who reported it — an incident raised by a sales agent still belongs to us; an SFB colleague's laptop ticket does not.

### 👤 Apoorv (Technical Lead; owner of #1121, SF ↔ GitHub sync)
2. Share the **exact field + status mapping** #1121 will emit, so the pilot can finish **US-072** (schema *conformance* — a small verification; you own the actual sync, the pilot just receives it cleanly).
3. Agree a **weekly 15-min sync-check** (in your existing technical meeting) so the two schemas don't drift — this is **US-079**.

### 👤 Halvor (ServiceNow) — *building the sending side*
4. **Queue table + outbound job** — his own proposal (a transactional outbox with retry, success/error/failed states and failure reporting), plus the **daily full-scope run** he has agreed to. Three design points still to confirm: an **idempotency key** per queue record (retries mean the same event can arrive twice), **ordering preserved per incident**, and **failure notifications reaching the pilot**.
5. **Build it against the simple test token first.** The GitHub App's JWT/certificate chain is a *production* requirement, not a starting one — proving the path on a plain bearer token keeps the auth complexity out of the first attempt. _(Firewall: done — he verified an unauthenticated `200` from the test environment on 2026-08-14.)_

### 👤 Isak Charrad (incident-process owner) — *two gates*
6. **Confirm the service-desk instance is non-sensitive.** The inversion did not remove this gate — incident content still leaves ServiceNow — and it can block late.
7. **Work notes vs comments.** Pilot proposal: automated updates go **outbound to work notes only** (internal, never reaching the caller), while **both** are read inbound so a reporter's comment isn't lost for triage.

### 👤 Martin (owner of #1595)
8. Share the **Matrix #1595 field mapping** and join the 30-minute mapping session.

### 👤 Carlos (pilot lead)
9. **Issue the test credential and hand it over via OneDrive** (agreed 2026-08-14 — Carlos has no Webex, and a personal account would lack the tenant encryption that made Webex acceptable). A fine-grained token scoped to one repository, Issues read/write, **~7-day expiry** — the scope and expiry are the real protection, not the channel. Delete the file once Halvor confirms. The first end-to-end test does *not* need the GitHub App; the test repo runs on this token, and the firewall covers it (same `api.github.com`). **Revoke it when the App takes over.**
10. **Offer Halvor App-manager rights on the production GitHub App**, so he downloads the private key straight into ServiceNow and it is never transmitted at all — better than any approved channel, and it removes the question his team is currently researching.
11. **Build the GitHub-side receiver**, exercised against a simulated payload — issue creation, correlation write-back, dedupe on repeat delivery.
12. **Ask `#nova-github` whether a fine-grained PAT is permitted on the production org.** This is worth more than it first appeared: it would remove the certificate handling, keystore conversion and JWT signing from the ServiceNow side entirely, making production identical to test. Telenor's order of preference is App → OAuth App → fine-grained PAT, so it is permitted-but-least-preferred, not banned. Keep the **GitHub App** moving in parallel either way.
13. Create the **Sprint** field in the Project (the one field the automation could not add) — **US-064**.

_Done since the last revision: **#136 / #137** merged (2026-07-08); the **status migration** to the 10-state SFB model executed with pre-migration snapshots kept as audit artifacts under [`docs/migrations/`](migrations/) (US-063 closed); **base Matrix access granted** 2026-08-04 (`RIT0469472`); the **firewall opening ordered**._

## The critical path (one sentence)

The single most valuable next step — **automating Ingrid's manual Matrix sync
(US-075)** — is no longer blocked by an approval: the **firewall opening went
live on 2026-08-13**, and the first end-to-end test needs only Halvor's queue job
plus a test token the pilot can issue itself. The **GitHub App** is still
required before production go-live, but it no longer gates testing.

## Once unblocked, the pilot will

Finish US-072 (SF conformance) and US-075 (Matrix conformance), wire role-based
checkpoint approvals (US-066), the UAT-before-production gate (US-067), and
per-flow success metrics (US-078) — completing the E-11 integration backlog.

---

_This file is a point-in-time handoff. The live delivery view is the [Pages
dashboard](https://carloshumbertoreyesortiz.github.io/agentic-sdlc-pilot/); the
authoritative process is [docs/way-of-work.md](way-of-work.md)._
