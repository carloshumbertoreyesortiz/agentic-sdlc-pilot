# Matrix ↔ GitHub Sync — Technical Next Steps

_From: Carlos Reyes + Claude Code · 13 July 2026_
_Downstream of [#1595](https://github.com/TelenorNorgeInternal/s06065-sfb-telenor-sfdc/issues/1595) (SFB team's integration) · pilot story US-075 · see also [way-of-work.md](way-of-work.md) §1 Flow C, §7 sync pattern_

## Context in one line

#1595 is the **SFB team's** integration (opened by Ingrid, implemented by Martin). The pilot does **not** own it — the pilot provides the **GitHub-side orchestration** and conforms to whatever ServiceNow emits. Today Ingrid does this sync **by hand, daily**; automating it removes that person-dependency (the pilot's key-person-risk KPI: 1 → 0).

## The dependency chain

Nothing downstream starts until Step 1 clears.

### Step 1a — Base Matrix access (the real first blocker) — owner: Halvor / Julie (sponsor)

- Retesting on a fresh VPN session showed `https://matrix.telenor.no/` does **not** load and the **service-catalog request page does not open** — this is an **underlying base-access gap**, beneath any specific role request.
- So the true first step is **base Matrix access** for Carlos / the pilot; **Halvor or Julie to sponsor** this request (ideally before Halvor's vacation, so it isn't stalled while he's away).
- **Done when:** Matrix loads and the service-catalog request page is reachable.

### Step 1b — Dedicated integration user + custom endpoint (NOT the AIR role) — owner: ServiceNow governance (Halvor / Julie), collaborative

The ServiceNow contact flagged (correctly, 2026-08-04) that **AIR is an end-user role for humans reporting incidents — the wrong fit for a system-to-system integration.** There is **no formal template** for service accounts; they're set up in collaboration with the project and **tied to a system, whose owner is responsible for the account** (the KB0010037/AIR line is superseded).

**Approach they recommend (their standard pattern, confirmed 2026-08-04):** a **custom Scripted REST endpoint** with its **own custom role**, exposed **web-service-only** and available **only to our integration user**. The endpoint can expose **several paths** depending on what we need — which lets them guarantee it's scoped to exactly us and exactly the operations we require (stronger than granting broad table roles). Their read of our docs: an endpoint over **the incident records relevant to us + the related work notes** covers the need.

- **Account:** a dedicated, non-personal **integration user**, tied to the pilot's sync as its "system." **Responsible owner (our side): Carlos / the pilot** — we should state this explicitly, since SN holds the system owner accountable for the account.
- **Endpoint:** SN-side custom Scripted REST API, web-service-only, gated to our custom role; paths per the contract we agree in Step 3.
- **Auth:** **OAuth 2.0** preferred; **basic auth** is the fallback. (Token auth for custom endpoints is TBD — contact is checking.)
- **Scope (least-privilege by construction):** only the incident records relevant to the pilot + their work notes/closure fields (Isak's note-handling semantics). No broad `itil`/`admin`.
- **Done when:** the integration user + custom role + endpoint exist; Carlos can authenticate and call one path to read a real incident.

### Step 2 — Connectivity check — owner: Pilot (Carlos + CC)

- Confirm the service account can reach the ServiceNow REST API and read the Matrix incident records in scope (a single authenticated read — no writes yet).
- **Done when:** we can pull one real incident record and see its fields.

### Step 3 — Field mapping (30-min session) — owner: Martin + Isak + Pilot

- Agree the mapping between a **Matrix/ServiceNow incident** and a **GitHub issue**: which fields flow, in which direction, and the key/identifier that links the two (so we never create duplicates).
- Decide **direction of truth** per field (e.g. status flows ServiceNow → GitHub; comments may flow both ways).
- **Define the endpoint path contract** (Step 1b): which paths the custom Scripted REST endpoint exposes — e.g. list-incidents-updated-since (inbound), get-one-incident-with-worknotes, add-worknote / update-status (outbound reverse-sync).
- **Define "relevant to us":** the filter for which incidents are in scope for the pilot (e.g. by assignment group / category), so the endpoint only ever returns our subset.
- **Isak Charrad** (incident-process owner) covers **note-handling and closure semantics** — how an incident is annotated and closed — so the mapping matches the real process, not just the field schema.
- Timing: the working session is planned for **August** (when Halvor is back), looping in Isak, Ingrid, and the team. In the meantime this doc is the async reference for Isak to review.
- **Done when:** a field-mapping table all sides sign off on. _(The pilot dashboard already has empty "Flow C" slots waiting for exactly these.)_

### Step 4 — Build the sync — owner: split

- **ServiceNow side (SN team):** the **custom Scripted REST endpoint** (Step 1b) exposing the agreed paths; optionally a Business Rule / scheduled job to signal updates.
- **GitHub side (Pilot):** orchestration that calls those paths — pulls in-scope incidents + work notes, creates/updates the matching GitHub issue, and pushes the agreed fields back via the outbound paths.
- Built behind a flag / against a test record first — **no production writes** until Step 5 passes.

**Future option — Kafka on Nova (noted 2026-08-04):** the SN team has discussed publishing incidents to a **Kafka topic on Nova**, but isn't there yet (resource-limited). If/when it lands, it's a cleaner **event-driven** source for the inbound direction than polling the REST endpoint. We'll build the GitHub side so the incident source is swappable — REST endpoint now, Kafka consumer later — with no rework of the mapping or the GitHub-side logic.

### Step 5 — Dry-run & validation — owner: Pilot + Martin, Ingrid verifies

- Run the sync on a small set of real-but-safe incidents; confirm round-trip correctness (create, update, status change, reverse-sync).
- Ingrid verifies the automated result matches what she'd have done by hand.
- **Done when:** a full round-trip works with zero manual correction.

### Step 6 — Go-live + monitoring — owner: Pilot

- Turn on the sync for live incidents.
- The pilot dashboard's **sync-health** and **Flow C** tiles switch from _"pending"_ to live numbers automatically, and the **key-person-risk measure moves 1 → 0** (Ingrid's manual task is retired).
- Ongoing: sync-failure rate and reverse-sync latency are already wired to display once data flows.

## What we need from each person, right now

| Person | Ask | Unblocks |
| --- | --- | --- |
| **Halvor / Julie** | Sponsor **base Matrix access** (site + catalog won't load), then set up a **dedicated integration user** with scoped incident/REST access (NOT the AIR role) | Steps 1a → 1b → everything |
| **Isak Charrad** | Review this doc async; define note-handling + closure semantics; join the field-mapping session | Step 3 correctness |
| **Martin** | 30-min field-mapping session (Step 3) + the ServiceNow-side outbound trigger (Step 4) | Steps 3–4 |
| **Ingrid** | Verify the dry-run matches her manual process (Step 5) | Step 5 sign-off |

## Governance note

The pilot only **reads** from ServiceNow via the service account and **orchestrates on the GitHub side**. Stewardship of #1595 and the ServiceNow integration stays with the SFB team — the pilot conforms, it doesn't take over.
