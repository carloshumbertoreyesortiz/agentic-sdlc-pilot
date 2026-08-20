# Matrix ↔ GitHub Sync — Technical Next Steps

_From: Carlos Reyes + Claude Code · 13 July 2026 · updated 5 August 2026 (post SN↔SFDC integration meeting) · **10 August 2026 (architecture inverted — ServiceNow initiates)**_
_Downstream of [#1595](https://github.com/TelenorNorgeInternal/s06065-sfb-telenor-sfdc/issues/1595) (SFB team's integration) · pilot story US-075 · see also [way-of-work.md](way-of-work.md) §1 Flow C, §7 sync pattern_

## Context in one line

#1595 is the **SFB team's** integration (opened by Ingrid, implemented by Martin). The pilot does **not** own it — the pilot provides the **GitHub-side orchestration** and conforms to whatever ServiceNow emits. Today Ingrid does this sync **by hand, daily**; automating it removes that person-dependency (the pilot's key-person-risk KPI: 1 → 0).

## Architecture decision (2026-08-10) — ServiceNow initiates everything

**The direction of initiation is now settled, and it inverts several earlier steps.** ServiceNow makes *all* the calls: it pushes incident changes to GitHub and polls GitHub for issue changes. Nothing calls into ServiceNow, and nothing calls into TNX.

**Why.** The alternative — GitHub Actions calling ServiceNow — would have required allowlisting GitHub's Actions egress on the Matrix side: **7,297 CIDRs (5,658 IPv4), which GitHub changes regularly** (verified against `api.github.com/meta`, 2026-08-10). No network team will maintain that, and it means an inbound opening into TNX. With ServiceNow initiating, all traffic is TNX **egress to `api.github.com`** — the same 26-CIDR allowlist already being ordered, and **no inbound opening at all**.

**What it changes:**

| Was | Now |
| --- | --- |
| SN integration user + custom Scripted REST endpoint for us to call (Step 1b) | **Not needed.** SN's internal system user runs the outbound job — Halvor confirmed. Step 1b is superseded by **Step 1b′** (SN-side queue + outbound REST). |
| Auth = basic auth on the SN endpoint | **Auth moves to the GitHub side.** ServiceNow authenticates *to GitHub* as a GitHub App (JWT → installation token). |
| Firewall = both directions | **Egress only.** `api` ranges only; the `hooks` set is **not** needed since GitHub never calls ServiceNow. |
| Critical path = ServiceNow provisioning (Halvor) | **Critical path = the GitHub side** — App approval + firewall approval, both with Telenor's GHEC platform team (Step 1d). |
| The pilot can read incidents on demand | **The pilot cannot query Matrix at all.** It only ever sees what is pushed — see the reconciliation requirement in §1b′. |

**Cost of the inversion, and the compensation.** Push-only means the GitHub side can count what *arrived* but never what *should have* arrived: a failed or never-enqueued record is invisible from our end, backfill has no mechanism, and US-074's sync-health KPI would only ever report on its own inbox. Compensated by the **daily full-scope run** in §1b′ — agreed by Halvor.

## The dependency chain

Nothing downstream starts until Step 1 clears.

### Step 1a — Base Matrix access — ✅ **RESOLVED 2026-08-04**

- Retesting on a fresh VPN session had shown `https://matrix.telenor.no/` did **not** load and the **service-catalog request page did not open** — an **underlying base-access gap**, beneath any specific role request.
- **Granted 2026-08-04** (`RIT0469472` / task `STA0436803`): Carlos Humberto Reyes Ortiz (`t456889`) added to the **AIR** group. _Reopen window on that ticket was five days._
- ⚠️ **AIR is not the integration credential.** AIR is the end-user incident-reporter role. It gives Carlos *human* access to Matrix; it is **not** the mechanism the sync runs on, and this grant does **not** advance Steps 1b′–1d. Recorded because "access granted" is easy to misread as "US-075 unblocked."
- **What it is actually worth:** direct inspection of real incidents — which is how the *"relevant to us"* filter (Step 3) gets defined from evidence rather than guesswork. See the recon note under Step 3.
- **Note:** the 2026-08-05 meeting had judged personal access likely moot for the *sync itself*. That still holds — the value is reconnaissance, not runtime.

### Step 1b — ~~Dedicated integration user + custom endpoint~~ — **SUPERSEDED 2026-08-10**

_Retained for the record._ The plan was an SN-side **integration user** plus a **custom Scripted REST endpoint** with its own custom role, which the pilot would call. Halvor had confirmed (2026-08-05) he would create both.

**The inversion removed the need for both.** With ServiceNow initiating every call, nothing authenticates *into* ServiceNow — the internal system user running the outbound job is sufficient. Halvor's own conclusion, and it is correct.

_(The earlier correction still stands and is worth keeping visible: **AIR is an end-user role for humans reporting incidents**, never the right fit for a system integration — flagged by the ServiceNow contact 2026-08-04, superseding the KB0010037/AIR line.)_

**What survives from this step:** the **sensitivity gate** — some ServiceNow instances hold sensitive data, and **Isak must confirm the service-desk instance in scope is non-sensitive** before incident content flows to GitHub. The inversion does not remove this; data still leaves ServiceNow. Halvor is following up with Isak (returning from parental leave).

### Step 1b′ — SN-side queue table + outbound job — owner: Halvor

Halvor's proposal (2026-08-10), and a better answer than the periodic push the pilot had asked for. **A transactional outbox:** a custom queue table holds queue records; a scheduled job processes them and sends to GitHub; the REST response sets each record to **success** or **error**; errors retry *N* times before reaching a **failed** state, with reports and notifications on failures. This is an established pattern on their side, already used for other integrations.

**Agreed / confirmed by Halvor:**

- **Queue table + retry + failure reporting** — his design, as above.
- **Daily full-scope run** alongside the incremental one ("that sounds like a good idea"). **This is not redundant with the queue** — the queue guarantees *everything enqueued is delivered*; it cannot detect *what was never enqueued* (a rule that didn't fire, a filter that's wrong). Only a full-scope sweep closes that gap, and it also handles backfill of incidents already open at go-live.
- **Encoded query lives on the SN side** ("yes, will do" — share it, and flag changes). Cheaper to change than a GitHub-side redeploy; the drift risk is covered by `R-SFB-COORDINATION`.

**Open asks on the queue design (raised 2026-08-10, not yet confirmed):**

1. ~~**A unique id per queue record, carried in the payload.**~~ **Superseded 2026-08-18 — see Step 4.** The concern is real (retry means **at-least-once** delivery: a request that succeeds but whose response is lost *will* be resent, creating duplicate issues), but an idempotency key needs a receiver to honour it and there isn't one — ServiceNow calls GitHub directly, and GitHub's API has no idempotency mechanism. Replaced by **search-before-create** keyed on `sys_id`, which is SN-side and needs nothing from GitHub.
2. **Ordering preserved per incident.** Events for one incident must arrive in sequence (a status change must not overtake its predecessor). Ordering *across* different incidents does not matter.
3. **Failure visibility reaching the pilot.** Halvor's reports/notifications are SN-side; if a record ends `failed` we should learn of it without asking — copy us on the notification, or include a failure summary in the daily full-scope run.

- **Done when:** the queue table and outbound job exist, and one queue record results in a real GitHub issue via `api.github.com` and is marked `success`.

### Step 1c — Network / firewall opening (test-first) — owner: Halvor (orders)

Confirmed as a concrete near-term step at the 2026-08-05 meeting; scope corrected by Ingrid. Matrix sits in **TNX**, so firewall openings must be ordered; the network team's turnaround is the main unknown.

**Status (2026-08-14): ✅ DONE AND VERIFIED.** Ordered 2026-08-10, approved by the TNN GitHub system owners, implemented 2026-08-13, and **verified from the ServiceNow test environment on 2026-08-14**: an unauthenticated `GET https://api.github.com/rate_limit` returned **200**. Halvor: _"I am confident that the network part is okey and that we can proceed with the integration."_

- **Why the unauthenticated call was the right check:** it returns `200` with no credentials, so it proves the network path **independently of auth**. Everything that fails from here is authentication or application logic — not the firewall. Two minutes spent to remove a whole layer from every future diagnosis, across two teams and a change window.

- **Path:** **Matrix (ServiceNow / TNX) → GitHub only** — **nothing** between SFB and Matrix (Ingrid, 2026-08-05). So this is *not* about our proxy's egress IP; it's about letting ServiceNow reach GitHub.
- **Egress only, one direction.** Since the inversion, GitHub never calls ServiceNow: the **`hooks` set is not needed**, only the `api` ranges. No inbound opening into TNX.
- **What Halvor allowlists:** **GitHub's REST API (`api.github.com`) IP ranges** on the Matrix / TNX egress side — the exact list is in **Appendix B** (26 CIDRs, kept fresh from `api.github.com/meta`). _Re-verified against the live source 2026-08-10: **zero drift**, all 24 IPv4 ranges unchanged since 2026-08-05._
- **Same IPs for test and prod:** both the test GitHub repo and the prod one are reached via `api.github.com`, so the allowlist is identical — only the target repo/auth differs (Appendix D).
- **This gates every end-to-end test**, for the test repo as much as production — same hostname, same allowlist. Until it is live there is no path to exercise, and (post-inversion) the pilot cannot initiate a test at all: the caller is ServiceNow.
- **Done when:** the test firewall opening is live and ServiceNow can reach `api.github.com`.

### Step 1d — GitHub App on the prod org — **required before go-live, not before testing** — owner: Carlos + GHEC platform team

**Reclassified 2026-08-13, when the firewall went live.** While the opening was closed this was the sole gate. It no longer is: the **test** target is the pilot's personal repo authenticated with **Carlos's own fine-grained token** — issuable immediately, no Telenor approval — and the allowlist is identical for test and prod because both go through `api.github.com` (Appendix D). **So the full path can be proven end to end now**, and the App reverts to a parallel lead-time item required before **production** writes to `TelenorNorgeInternal/s06065-sfb-telenor-sfdc`, where **classic PATs are banned** (Appendix C/D).

⚠️ **Revoke the test token when the App takes over.** A personal credential surviving into production recreates exactly the single-person dependency US-075 exists to remove. Scope it narrowly from the start: one repository, **Issues: Read & write** + **Metadata: Read**, short expiry.

**The pilot must not become the blocker.** Halvor returns to the queue build within days; the test credential should be waiting for him, delivered by his team's credential process (not mail or Teams).

#### Two-phase auth — do **not** build JWT first (decided 2026-08-14)

Halvor read the GitHub App guide and asked whether the private-key + certificate-import + JWT chain is really required. It is — **for production**. It is **not** required to start, and conflating the two would front-load the hardest part of the integration onto the first attempt.

| Phase | Target | Credential | ServiceNow-side work |
| --- | --- | --- | --- |
| **Test (now)** | Pilot's personal repo | Fine-grained token, self-issued by Carlos | `Authorization: Bearer <token>` — **no JWT, no certificate, no key import** |
| **Production** | `TelenorNorgeInternal/s06065-sfb-telenor-sfdc` | GitHub App | JWT signing → installation-token exchange → hourly refresh |

**So the whole queue table, outbound job, retry handling and correlation write-back can be built and proven end to end against a plain bearer token**, with the JWT layer added afterwards as an isolated change against already-working logic. Separates integration mechanics from auth complexity.

**Production auth mechanics (Halvor's guide is correct):** sign a **JWT** with the App's private key — **RS256**, ten-minute maximum lifetime, issuer = the App ID — then exchange it at `POST /app/installations/{installation_id}/access_tokens` for an **installation token valid one hour**, and use that as the bearer. Halvor (2026-08-10): _"we'll just have the job check for a valid token before running and renew it if needed."_ That is exactly the right pattern.

**Two known failure points, flagged before they cost a debugging cycle:**

1. **Key format.** GitHub issues the private key as a **PKCS#1 PEM** (`-----BEGIN RSA PRIVATE KEY-----`). ServiceNow's certificate store generally expects **PKCS#8**, or a PKCS#12/JKS keystore — so a conversion step (`openssl pkcs8 -topk8`, or wrapping into PKCS#12) is normally needed before the import will succeed. An import failure here looks like a permissions problem and isn't.
2. **Clock skew.** GitHub rejects a JWT whose `iat` is in the future. The instance clock must be accurate; backdating `iat` by ~60s avoids intermittent failures.

**Still worth asking:** whether a **fine-grained PAT is permitted on the production org**. Appendix C records Telenor's order of preference as GitHub App → OAuth App → fine-grained PAT — permitted but least preferred, *not* banned (only **classic** PATs are). If it is accepted for this integration, the certificate handling, keystore conversion and JWT signing all disappear and production becomes identical to test. Open question with `#nova-github`; **not a blocker** — JWT remains the working assumption.

#### Credential handover — the two credentials need different treatment

Halvor first proposed **Webex** (Telenor-encrypted, cleared for this data classification). Carlos has no Webex access, and a personal Webex account would not carry the tenant encryption that makes it acceptable — so the property Halvor relies on would be lost while appearing satisfied. Resolved separately for each credential:

| Credential | What it unlocks | Channel | Status |
| --- | --- | --- | --- |
| **Test token** (fine-grained PAT) | Issues on a *personal sandbox repo*. No Telenor data, no production, no org access | **OneDrive / SharePoint**, shared with Halvor alone, deleted on confirmation | **Agreed 2026-08-14** |
| **App private key** | The **production** `TelenorNorgeInternal` org | Ideally **none** — see below | Open; Halvor checking with his team |

**Scope is the real protection for the test token, not the channel:** single repository, **Issues: Read & write** + **Metadata: Read**, **short expiry (~7 days)**. A credential that narrow and that short-lived is low-value by construction. Note OneDrive cleanup is less complete than it appears — version history retains prior copies and deletion leaves recycle-bin entries in two places — which is precisely why the expiry is the backstop rather than the deletion.

**Preferred answer for production — transmit nothing.** GitHub Apps support **App managers**: adding Halvor as a manager lets him generate and download the private key **directly from GitHub into ServiceNow**, so it never passes between the parties and no channel needs approving. *"The key was never transmitted"* is a stronger audit position than *"the key was transmitted over an approved channel."* Raised with Halvor 2026-08-14, ahead of his team's answer.

_(Signal was floated by Halvor as something his team has used before. His team's call — noted only that it typically places a production credential on a personal device, which App managers avoids entirely.)_

**Not urgent:** the production App is still awaiting approval, so the channel question has time to settle. Only the test token gates progress.

**Also still available — eliminate the test transfer too:** the sandbox repo does **not** have to be the pilot's. If Halvor creates it on his own GitHub account, he generates his own token and nothing is exchanged at all; Carlos joins as a collaborator to observe and build the receiver against real payloads. Offered 2026-08-14; Halvor opted for OneDrive instead, which is fine for a credential this narrow.

**Possible shortcut worth trying:** the firewall order (Step 1c) is awaiting approval from *"the owners of the TNN GitHub system."* If that is the same GHEC platform team handling this App request, **one contact holds both blockers** — raise the firewall approval in the same `#nova-github` thread.

- **Request:** ask in `#nova-github` for the register/approve process + the org-owner approver (draft request prepared 2026-08-05).
- **Create the app (least-privilege):** permissions **Issues: Read & write** + **Metadata: Read** only (add Issues/Issue-comment webhook events *only* if reverse-sync is event-driven); installable setting **"Only on this account"**.
- **Install** to `TelenorNorgeInternal`, scoped to **only** `s06065-sfb-telenor-sfdc`; then **transfer app ownership to the org** (survives Carlos's membership; he keeps "Application manager").
- **Test meanwhile:** the pilot's personal repo can be exercised with Carlos's own access, so this step doesn't block early testing.
- **Done when:** the app is installed on the prod org/repo, ownership transferred, and the pilot can authenticate and create/update an issue there.

### Step 2 — Connectivity check — ✅ **DONE 2026-08-20**

**The path works end to end: ServiceNow → `api.github.com` → GitHub issue → board fields applied automatically.**

Evidence — Halvor's queue record `GITINC0001003` (incident `INC0069821`, sys_id `314e73f125fe031013231c4f2ab58dff`) from the SN **test** instance:

| | |
| --- | --- |
| Issue created | [#168](https://github.com/carloshumbertoreyesortiz/agentic-sdlc-pilot/issues/168) |
| Workflow run | `32364925881` — success |
| Fields applied | **8 of 8** — Type `Incident`, Sub Epic `Matrix Defect`, External Reference Type `Matrix` / Id `INC0069821` / URL, Priority `P3`, Status `Backlog`, Caller `Halvor Mortensen` |
| Verified | Read back off the live Project, not just from the run log |

- The pilot could not run this check: since the inversion ServiceNow is the caller. What the pilot supplied instead of code was the [field-mapping contract](matrix-github-field-mapping.md), so Halvor was not inventing a payload the schema would reject.
- **Network half** was proven separately on 2026-08-14 (Step 1c, unauthenticated `200`), which is why the only failures left to find here were application-level.

#### What the pre-flight smoke test caught — and why it was worth running

A synthetic incident ([#166](https://github.com/carloshumbertoreyesortiz/agentic-sdlc-pilot/issues/166), kept as a known-good reference) was pushed through the same path an hour before Halvor's attempt. It surfaced **three defects that would otherwise have appeared during his test, with him watching**:

1. **The `matrix` and `incident` labels did not exist in the repo.** The workflow's entire trigger is `contains(labels, 'matrix')`. Created with proper colours and descriptions.
2. **`PROJECT_TOKEN` held a fine-grained token** (99 chars) rather than a classic one (40) — a leftover from the incorrect guidance. It returned `401 Bad credentials`, which *masked* the next defect entirely.
3. **A real bug in `scripts/apply-matrix-fields.ts`:** `gh api graphql -f` sends every variable as a string, so `$number: Int!` arrived as `"1"` and was rejected. Fixed by dispatching on JavaScript type (numbers via `-F`).

**None of these were reachable by the unit tests** — they never exercise the `gh` subprocess or the live Project. The lesson for the production cutover is in [`matrix-sync-cutover.md`](matrix-sync-cutover.md): a synthetic issue pushed through the real path is the only check that finds this class of problem, and it costs ten minutes.

Halvor's own first attempt then found only one issue, which he had already spotted himself: `matrix-fields` serialised as `[object Object]` before he added the `JSON.stringify`.

#### Open cosmetic defect (his side, no urgency)

The External Reference URL carries a **double slash** — `https://matrix-test.telenor.no//nav_to.do?…` — from a trailing slash on the base URL meeting a leading slash on the path. Functional, just untidy on the board.

#### ✅ Update path — proven 2026-08-20

Halvor moved `INC0069821` to In Progress and re-sent the regenerated body. The `edited` trigger fired, run `32365740038` succeeded, and the board **Status moved `Backlog` → `Development`** automatically — verified on the live Project.

_Reported initially as a possible failure: the GitHub issue still showed **Open**. It was working. **Issue state** (Open/Closed) and the **Status field** are different things, and only the second tracks the lifecycle — now called out explicitly in the [mapping contract](matrix-github-field-mapping.md) §3, since the first person to use the integration hit it within an hour._

#### Still outstanding

- **Duplicate guard:** re-send the same incident and confirm search-before-create prevents a second issue. The only untested mechanism left, and the one standing between at-least-once delivery and duplicate issues.
- **End-of-life states:** confirm `Closed → Status Done` and `Cancelled → close the issue as not planned`. Both untested, and both are where issue state and Status field finally interact.
- **Work notes / comments**, once Isak confirms the semantics.

### Step 3 — Field mapping (30-min session) — owner: Martin + Isak + Pilot

- Agree the mapping between a **Matrix/ServiceNow incident** and a **GitHub issue**: which fields flow, in which direction, and the key/identifier that links the two (so we never create duplicates).
- Decide **direction of truth** per field (e.g. status flows ServiceNow → GitHub; comments may flow both ways).
- **Isak Charrad** (incident-process owner) covers **note-handling and closure semantics** — how an incident is annotated and closed — so the mapping matches the real process, not just the field schema.
- Timing: the working session is planned for **August**, looping in Isak, Ingrid, and the team. In the meantime this doc is the async reference for Isak to review.
- **Done when:** a field-mapping table all sides sign off on. _(The pilot dashboard already has empty "Flow C" slots waiting for exactly these.)_

**Settled 2026-08-10 — the identity handshake.** Halvor raised the `INC`-collision problem: incident numbers are only `INC` + a counter, so they can repeat across ServiceNow instances. Agreed resolution:

| Purpose | Field | Why |
| --- | --- | --- |
| Machine key (match on this) | ServiceNow **`sys_id`** | Globally unique; immune to the multi-instance collision |
| Human-readable label | Incident **number** (`INC…`) | Nobody should have to read a GUID in a GitHub issue — display only, never the match key |
| Reverse link (SN → GitHub) | **`correlation_id`** / **`correlation_display`** on the incident | The pilot returns the created issue's **number and URL in the REST response body**; Halvor's job writes them back. Closes the loop both ways with no separate mapping table. |

**Settled 2026-08-10 — notes vs comments.** Halvor confirmed the semantics: **comments are visible to the reporter; work notes are for case handlers.** Pilot proposal, pending Isak's confirmation:

- **Outbound (GitHub → Matrix): work notes only.** Automated engineering progress is internal and must not surface to the caller. Halvor concurs — _"if it's strictly internal it should be work notes."_
- **Inbound (Matrix → GitHub): both**, provided each is typed so the two never get confused. A reporter's comment is frequently the detail that explains the defect; losing it would degrade triage. The hard requirement is that an internal work note must never be echoed back into anything reporter-visible.

**Defining "relevant to us" — evidence, not guesswork.** The filter (assignment group / CI / business service) decides what the integration returns forever. Two anchors:

- **Scope by affected system, not by reporter.** An incident against the SFB Salesforce application matters whoever raised it — often a sales agent or customer service, not an SFB team member — while an SFB colleague's laptop ticket is out of scope. "Reported on SFB" is the wrong axis.
- **Ingrid's manual selection *is* the specification.** She performs this filtering by hand daily. The route to a defensible filter is to take incidents she has recently turned into GitHub issues and identify the field values they share — now possible directly, since Step 1a granted Carlos read access to real incidents.
- ⚠️ **Risk to surface early:** if part of her selection turns out to be judgement rather than a field value, no query can reproduce it, and the session must convert that judgement into an explicit predicate. Better discovered before the job is built than after.

### Step 4 — Build the sync — owner: split

> **Correction (2026-08-18): there is no pilot-hosted "receiver".** Earlier revisions of this step described the GitHub side as a service that accepts queue records. That cannot be right — the firewall was opened to **`api.github.com`**, not to any pilot endpoint, no such endpoint exists or has been requested, and GitHub Actions cannot receive inbound HTTP. **ServiceNow calls GitHub's REST API directly.** Nothing of the pilot's sits in the request path.

- **ServiceNow side (SN team):** the **queue table + scheduled job** (Step 1b′), which builds the issue payload itself and calls `POST /repos/{owner}/{repo}/issues` on `api.github.com`, then reads the **`number`** and **`html_url`** straight out of GitHub's own response for the correlation write-back. Polls GitHub for issue changes on the reverse direction. Retry, success/error/failed states, and the daily full-scope run as per Step 1b′.
- **GitHub side (Pilot):** **a specification, not a service.** What the pilot owes is the [field-mapping contract](matrix-github-field-mapping.md) — which incident field becomes which issue field, the exact JSON body, and the duplicate-prevention query — plus the issue schema (Type, Sub Epic, labels, External References) those payloads must satisfy. The reference implementation in `src/matrix-mapping.ts` is executable documentation of that contract, not a runtime component.
- Built behind a flag / against a test record first — **no production writes** until Step 5 passes.

**Consequence for idempotency (supersedes the earlier ask).** With ServiceNow calling GitHub directly there is no receiver to honour an idempotency key, and **GitHub's API has no idempotency mechanism**. The workable pattern is **search-before-create**: query GitHub for the incident's `sys_id` and only create when nothing comes back. Exact query in the mapping contract. This self-heals the lost-response retry the key was meant to cover, and needs nothing from GitHub's side.

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
| **Carlos** ⭐ | **Issue the test token and hand it over via Webex** — Halvor is ready to build and the pilot must not become the blocker. Then: ask `#nova-github` whether a **fine-grained PAT is permitted on the prod org** (would delete the whole JWT layer), and keep the **GitHub App** moving for go-live | Step 2 now; Step 1d before prod |
| **Halvor** | Build the **queue table + outbound job** (Step 1b′) **against the simple bearer token first** — JWT only when prod comes; confirm the three open asks — **idempotency key**, **per-incident ordering**, **failure visibility to the pilot** | Steps 1b′, 2 |
| **Isak Charrad** | **Confirm the service-desk instance is non-sensitive** (the gate — the inversion does not remove it); confirm **work notes outbound / both inbound**; join the field-mapping session | Step 1b gate, 3 |
| **Ingrid** | Identify which incidents she currently syncs by hand — her selection defines *"relevant to us"* (Step 3); verify the dry-run matches her manual process (Step 5) | Steps 3, 5 |
| **Martin** | Owner of #1595; the 30-min field-mapping session (Step 3) | Steps 3–4 |

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
