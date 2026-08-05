# Matrix ↔ GitHub Sync — Technical Next Steps

_From: Carlos Reyes + Claude Code · 13 July 2026 · updated 5 August 2026 (post SN↔SFDC integration meeting)_
_Downstream of [#1595](https://github.com/TelenorNorgeInternal/s06065-sfb-telenor-sfdc/issues/1595) (SFB team's integration) · pilot story US-075 · see also [way-of-work.md](way-of-work.md) §1 Flow C, §7 sync pattern_

## Context in one line

#1595 is the **SFB team's** integration (opened by Ingrid, implemented by Martin). The pilot does **not** own it — the pilot provides the **GitHub-side orchestration** and conforms to whatever ServiceNow emits. Today Ingrid does this sync **by hand, daily**; automating it removes that person-dependency (the pilot's key-person-risk KPI: 1 → 0).

## The dependency chain

Nothing downstream starts until Step 1 clears.

### Step 1a — Base Matrix access (the real first blocker) — owner: Halvor / Julie (sponsor)

- Retesting on a fresh VPN session showed `https://matrix.telenor.no/` does **not** load and the **service-catalog request page does not open** — this is an **underlying base-access gap**, beneath any specific role request.
- So the true first step is **base Matrix access** for Carlos / the pilot; **Halvor or Julie to sponsor** this request (ideally before Halvor's vacation, so it isn't stalled while he's away).
- **Update (2026-08-05 meeting):** Carlos's *personal* Matrix access is likely **moot** — the sync runs as the **integration user** (Halvor creates it) reaching the endpoint via the proxy, not from Carlos's browser. Personal access is only needed if Carlos must inspect Matrix directly; otherwise this step is superseded by Steps 1b/1c.
- **Done when:** Matrix loads and the service-catalog request page is reachable (or this step is confirmed unnecessary).

### Step 1b — Dedicated integration user + custom endpoint (NOT the AIR role) — owner: ServiceNow governance (Halvor / Julie), collaborative

The ServiceNow contact flagged (correctly, 2026-08-04) that **AIR is an end-user role for humans reporting incidents — the wrong fit for a system-to-system integration.** There is **no formal template** for service accounts; they're set up in collaboration with the project and **tied to a system, whose owner is responsible for the account** (the KB0010037/AIR line is superseded).

**Approach they recommend (their standard pattern, confirmed 2026-08-04):** a **custom Scripted REST endpoint** with its **own custom role**, exposed **web-service-only** and available **only to our integration user**. The endpoint can expose **several paths** depending on what we need — which lets them guarantee it's scoped to exactly us and exactly the operations we require (stronger than granting broad table roles). Their read of our docs: an endpoint over **the incident records relevant to us + the related work notes** covers the need.

- **Account:** a dedicated, non-personal **integration user** — **Halvor confirmed (2026-08-05) he will create and handle it.** Two are made: **one for the test environment, one for prod** (SN standard practice).
- **Responsible owner:** **Martin** is the owning party for #1595 / the integration (SFB-side); **Carlos is the technical point of contact** (external consultant). Stated because SN holds the system owner accountable for the account.
- **Endpoint:** SN-side custom Scripted REST API, web-service-only, gated to our custom role; paths per the contract we agree in Step 3. **Halvor confirmed (2026-08-05) he's fine building a custom endpoint for us.**
- **Auth:** **basic auth is acceptable and is what Halvor typically uses for integration users**; **OAuth** if the endpoint supports it (Halvor to confirm the endpoint). **No token** — both sides preferred to avoid token-renewal overhead.
- **Scope (least-privilege by construction):** only the incident records relevant to the pilot + their work notes/closure fields (Isak's note-handling semantics). No broad `itil`/`admin`.
- **Sensitivity gate:** some ServiceNow instances hold sensitive data. **Isak must confirm the service-desk instance in scope is non-sensitive** before it's opened to us (Halvor is following up with Isak, who is returning from parental leave).
- **Done when:** the integration user + custom role + endpoint exist; Carlos can authenticate and call one path to read a real incident.

### Step 1c — Network / firewall opening (test-first) — owner: Halvor (orders)

Confirmed as a concrete near-term step at the 2026-08-05 meeting; scope corrected by Ingrid. Matrix sits in **TNX**, so firewall openings must be ordered; the network team's turnaround is the main unknown.

- **Path:** **Matrix (ServiceNow / TNX) ↔ GitHub only** — **nothing** between SFB and Matrix (Ingrid, 2026-08-05). So this is *not* about our proxy's egress IP; it's about letting ServiceNow reach GitHub.
- **What Halvor allowlists:** **GitHub's REST API (`api.github.com`) IP ranges** on the Matrix / TNX egress side — the exact list is in **Appendix B** (26 CIDRs, kept fresh from `api.github.com/meta`).
- **Same IPs for test and prod:** both the test GitHub repo and the prod one are reached via `api.github.com`, so the allowlist is identical — only the target repo/auth differs (Appendix D).
- **Test environment first:** prove the path against the **test** GitHub repo (the pilot's personal repo is a candidate — Appendix D), then repeat for prod.
- **Done when:** the test firewall opening is live and ServiceNow can reach `api.github.com`.

### Step 1d — GitHub App on the prod org (parallel lead-time) — owner: Carlos + GHEC platform team

Runs **in parallel** with Steps 1a–1c — it has approval lead time, so start it now; don't serialize it after the firewall. Prod writes to `TelenorNorgeInternal/s06065-sfb-telenor-sfdc`, where **classic PATs are banned**, so programmatic access needs a **GitHub App** (see Appendix C/D).

- **Request:** ask in `#nova-github` for the register/approve process + the org-owner approver (draft request prepared 2026-08-05).
- **Create the app (least-privilege):** permissions **Issues: Read & write** + **Metadata: Read** only (add Issues/Issue-comment webhook events *only* if reverse-sync is event-driven); installable setting **"Only on this account"**.
- **Install** to `TelenorNorgeInternal`, scoped to **only** `s06065-sfb-telenor-sfdc`; then **transfer app ownership to the org** (survives Carlos's membership; he keeps "Application manager").
- **Test meanwhile:** the pilot's personal repo can be exercised with Carlos's own access, so this step doesn't block early testing.
- **Done when:** the app is installed on the prod org/repo, ownership transferred, and the pilot can authenticate and create/update an issue there.

### Step 2 — Connectivity check — owner: Pilot (Carlos + CC)

- Confirm the integration user can reach the ServiceNow REST endpoint and read the Matrix incident records in scope (a single authenticated read — no writes yet). Depends on Step 1c (firewall open).
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
| **Halvor** | Create the **integration user** (test + prod) + **custom endpoint**; **order the Matrix→GitHub firewall opening** using GitHub's REST API IPs (Appendix B — we supply the list) | Steps 1b, 1c |
| **Isak Charrad** | **Confirm the service-desk instance is non-sensitive** (the gate); define note-handling / closure semantics; join the field-mapping session | Steps 1b gate, 3 |
| **Carlos** | Send Halvor the **`api.github.com` IP list** (Appendix B); decide the **test GitHub repo** (personal vs a Telenor test repo); start the **GitHub App** request for the prod org | Steps 1c, 4 |
| **Martin** | Owner of #1595; the 30-min field-mapping session (Step 3) | Steps 3–4 |
| **Ingrid** | Verify the dry-run matches her manual process (Step 5) | Step 5 sign-off |

## Governance note

The pilot reads incidents from ServiceNow and writes back work notes / status via the **scoped custom endpoint** (least-privilege, only in-scope incidents), and **orchestrates on the GitHub side**. Stewardship of #1595 and the ServiceNow integration stays with the SFB team (**Martin** owns it; Carlos is technical POC) — the pilot conforms, it doesn't take over.

## Appendix — Firewall / systems to open + GitHub-side integration model

Clarified by Ingrid (2026-08-05): the firewall openings are about the **systems/endpoints in the path**, *not* anyone's personal IP. **Corrected scope:** the opening is needed **between Matrix (ServiceNow / TNX) and GitHub only** — **nothing** is needed between SFB and Matrix.

### A. The path and what to allowlist

- **Path:** **Matrix (ServiceNow, in TNX) ↔ GitHub** — specifically the GitHub org/repo **`TelenorNorgeInternal/s06065-sfb-telenor-sfdc`** (confirmed 2026-08-05; the same repo as #1121/#1595).
- **What Halvor allowlists on the Matrix / TNX egress side:** **GitHub's REST API endpoint** (`api.github.com`) IP ranges — so ServiceNow/Matrix can reach GitHub. (GitHub is SaaS; you allowlist *its* published IPs on the Telenor egress, you don't "open GitHub's firewall".)
- **Owner (GitHub / Telenor side):** GHEC platform team (Nova `dev-tools/github-enterprise-cloud`; urgent → `#nova-github` Slack).

### B. GitHub REST API IP ranges — the list for the firewall order

Canonical sources: GitHub Docs — *["About GitHub's IP addresses"](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-githubs-ip-addresses)* — and the machine-readable **`https://api.github.com/meta`** (`.api`). **GitHub states these ranges change — pull from `meta`, don't hand-freeze.** Refresh with: `gh api meta -q '.api[]'` (or `curl -s https://api.github.com/meta | jq -r '.api[]'`).

**`api.github.com` ranges as of 2026-08-05 (26 CIDRs):**

_IPv4:_
```
192.30.252.0/22   185.199.108.0/22   140.82.112.0/20   143.55.64.0/20
20.201.28.148/32  20.205.243.168/32  20.87.245.6/32    4.237.22.34/32
4.228.31.149/32   20.207.73.85/32    20.27.177.116/32  20.200.245.245/32
20.175.192.149/32 20.233.83.146/32   20.29.134.17/32   20.199.39.228/32
20.217.135.0/32   4.225.11.201/32    4.208.26.200/32   20.26.156.210/32
172.182.252.137/32 4.249.131.166/32  48.202.248.39/32  48.204.201.2/32
```
_IPv6:_
```
2a0a:a440::/29    2606:50c0::/32
```

Hostname reached: `api.github.com` (REST + GraphQL). If GitHub must also push webhooks to a ServiceNow listener, add the `hooks` set (6 CIDRs) from `meta`; not needed if ServiceNow only *calls* GitHub.

### C. GitHub-side integration & auth model — Telenor GHEC rules

The production GitHub side targets **Telenor-managed orgs** (#1121/#1595 live in `TelenorNorgeInternal`). Per Telenor's GHEC integration guide, programmatic access there **must** use, in order of preference:

1. **GitHub App** (preferred), 2. OAuth App, 3. Fine-grained PAT.

- **Classic PATs are banned** in Telenor and cannot be used for programmatic access. → The pilot's personal-repo / classic-PAT approach **cannot** be used against Telenor orgs; production needs a **GitHub App**.
- **App setup (least privilege):** installable setting **"Only on this account"**; install to the target org, **only the relevant repositories**; then **transfer app ownership to the org** so it survives Carlos's membership (requester keeps "Application manager").
- **Install request:** an org owner approves the installation (urgent → `#nova-github`).
- **Auth as the app:** `octokit.js` handles it; from GitHub Actions use the whitelisted `actions/create-github-app-token`. One app **per org** (separate installation IDs + private keys) if more than one org is involved.

### D. GitHub target — test vs prod (resolved 2026-08-05)

| Env | GitHub target | Auth |
| --- | --- | --- |
| **Test** | The pilot's personal repo (`carloshumbertoreyesortiz/agentic-sdlc-pilot`) is a candidate — lets us prove the Matrix↔GitHub path without waiting on org onboarding | Carlos's own access (fine-grained PAT / personal app) |
| **Prod** | **`TelenorNorgeInternal/s06065-sfb-telenor-sfdc`** (the #1121/#1595 repo, confirmed) | **GitHub App** (Section C — classic PATs banned; app installed to the org, ownership transferred) |

**Firewall implication:** both test and prod are reached over **`api.github.com`**, so the allowlist (Appendix B) is **the same for both** — Halvor orders it once. Only the auth + target repo differ. **Before go-live**, the pilot must stand up the **GitHub App** on the prod org (a lead-time item — start the install request early via `#nova-github`).
