# Matrix ↔ GitHub sync — production cutover checklist

_From: Carlos Reyes + Claude Code · 20 August 2026_
_Companion to [technical-next-steps-matrix-sync.md](technical-next-steps-matrix-sync.md) (the plan) and [matrix-github-field-mapping.md](matrix-github-field-mapping.md) (the contract) · US-075_

## Why this exists

Everything proven on 2026-08-20 ran in the **pilot's personal sandbox**: `carloshumbertoreyesortiz/agentic-sdlc-pilot`, a user-owned Project, a classic token, and a workflow that lives in that repo.

**Production is a different repo, a different organisation and a different Project.** None of the sandbox setup travels with it. The failure mode is quiet: the first production incident arrives as a bare issue with an empty board row, and nothing errors.

Every item below is here because the sandbox run proved it was needed — not because it seemed prudent.

## The order matters

Labels and the workflow must exist **before** the first production incident arrives, and the credential model must change **before** the workflow can do anything. Cutting over in the wrong order produces issues that land but are never decorated, and they must then be fixed by hand.

---

## 1 — Prerequisites (no cutover until all five are true)

**The App:** `matrix-sfb-sync` · **App ID `4671001`** · created 2026-08-21.

> ⚠️ **Transfer BEFORE install — the reverse does not work.** The Nova guide mandates *"Where can this GitHub App be installed?"* = **Only on this account**, and that setting restricts installation to whoever **owns** the App. While it is personally owned, the install page offers only the personal account and the organisation never appears. The org becomes installable only once it owns the App. The Nova guide lists *Install App* before *Transfer ownership*, but the two cannot be done in that order under its own required setting.

| # | Item | Owner | Status | Verify |
| --- | --- | --- | --- | --- |
| 1.1 | App created — Issues read/write + Metadata read, webhooks off, "Only on this account" | Carlos | ✅ 2026-08-21 | App ID `4671001` |
| 1.2 | **Transfer to `TelenorNorgeInternal` requested** | Carlos | ✅ requested 2026-08-21, `#nova-github` posted | "Transfer request sent" |
| 1.3 | Transfer **accepted** by an org owner | Org owner (`#nova-github`) | ⏳ waiting | Owner reads `TelenorNorgeInternal`; Carlos shows as *Application manager* |
| 1.4 | **Installed** on `s06065-sfb-telenor-sfdc` only | Carlos — **only possible after 1.3** | ⏳ blocked by 1.3 | App appears under the org's installed apps |
| 1.5 | **`HalvorMortensen` added as an App manager** | Org owner | ⏳ requested | He can see the App's settings page and generate the private key |
| 1.6 | **Isak's sensitivity gate** — the service-desk instance holds no sensitive data | Isak | ⏳ outstanding since 2026-08-05 | Recorded in `risks.md` (`R-SERVICENOW-DEPENDENCY`) |

> **No private key has been generated, deliberately.** The first one is Halvor's to create once 1.5 lands — that is the whole point of the App-manager route, and generating one now would mean either transmitting it or deleting it later.
>
> **1.6 is the one that can block late.** It is unrelated to anything technical and has been outstanding since 2026-08-05.

## 2 — Prepare the production repo *before* any incident arrives

| # | Item | Note |
| --- | --- | --- |
| 2.1 | Create the **`matrix`** and **`incident`** labels in `s06065-sfb-telenor-sfdc` | ⚠️ **This is the one that bit the sandbox.** The workflow's entire trigger is `contains(labels, 'matrix')`. The REST API will auto-create a missing label with a random colour, so the sync *appears* to work while the label carries no meaning and no description. Create them deliberately. |
| 2.2 | Copy **`.github/workflows/matrix-issue-fields.yml`** into the production repo | Workflows only run in the repo they live in. Without this, issues land undecorated and nothing reports an error. |
| 2.3 | Copy **`scripts/apply-matrix-fields.ts`** and its `src/matrix-mapping.ts` dependency | Or vendor the script — but keep one source of truth, or the two copies drift. |
| 2.4 | Set `PROJECT_OWNER` / `PROJECT_NUMBER` in the workflow to the **org** Project | The sandbox values are hardcoded defaults in the script and **will silently target the wrong board**. |
| 2.5 | Confirm the org Project carries the same field **names and single-select options** | Field IDs are resolved by name at runtime, so a renamed field or a missing option logs a skip rather than failing. Priority `P0–P3` in particular — see the correction in the mapping doc. |

## 3 — Change the credential model

| # | Item | Note |
| --- | --- | --- |
| 3.1 | ServiceNow switches from the sandbox token to **App authentication** — JWT → installation token | Halvor's work, deferred from the test phase. Nova docs carry a working bash example of the flow. |
| 3.2 | Halvor generates the App **private key himself** as an App manager | It is never transmitted. Delete any other private keys on the App afterwards — an App can hold several, all valid until explicitly deleted. |
| 3.3 | Replace `PROJECT_TOKEN` | The sandbox used a **classic** token with `project` scope, because fine-grained tokens cannot reach *user-owned* Projects. The production Project is **org-owned**, so this constraint disappears — the App can carry Projects permission properly, or a fine-grained token scoped to the org. |
| 3.4 | Repoint ServiceNow's target repo to `TelenorNorgeInternal/s06065-sfb-telenor-sfdc` | Same `api.github.com` host, so **no new firewall opening is needed** (Appendix D). |

## 4 — Prove it before trusting it

| # | Item | Note |
| --- | --- | --- |
| 4.1 | Push a **synthetic incident** through the full production path first | Ten minutes. In the sandbox this found three defects — missing labels, the wrong token type, and a real bug in the GraphQL helper — **none of which the unit tests could reach**, because they never exercise the `gh` subprocess or a live Project. Do not skip it on the grounds that the sandbox already worked; the sandbox is not what is being tested. |
| 4.2 | Verify the fields **on the board**, not from the run log | A green run only proves the script did not throw. |
| 4.3 | Prove the **update** path — change state, re-send, confirm Status follows | Separate machinery from create. |
| 4.4 | Prove the **duplicate guard** — re-send the same incident, confirm no second issue | Retry makes delivery at-least-once; this is the only thing standing between that and duplicate issues. |
| 4.5 | **Ingrid verifies** the automated result matches what she would have done by hand | Step 5 sign-off. |
| 4.6 | Close and delete the synthetic issue | Leave the sandbox one ([#166](https://github.com/carloshumbertoreyesortiz/agentic-sdlc-pilot/issues/166)) as the known-good reference. |

## 5 — Clean up the test-phase scaffolding

Both credentials below were deliberately scoped and time-boxed. Leaving them alive after cutover recreates the single-person dependency US-075 exists to remove — they are bound to Carlos's account, and Rune's warning applies: **eviction of the owning user invalidates them**.

| # | Item |
| --- | --- |
| 5.1 | **Revoke the sandbox issues token** given to Halvor over Teams |
| 5.2 | **Revoke the classic `PROJECT_TOKEN`** once the org Project is driven by the App |
| 5.3 | Delete the sandbox `PROJECT_TOKEN` repository secret |
| 5.4 | Confirm nothing in the production path authenticates as a named human |

## 6 — Flip the measurements

| # | Item |
| --- | --- |
| 6.1 | Populate `docs/metrics/phase1-metrics.json` — Flow C metrics stop being `pending` once real incidents flow |
| 6.2 | **Key-person-risk KPI 1 → 0** — the headline number the whole story exists to move. Only when Ingrid's manual pass has actually stopped, not when the sync first works |
| 6.3 | Close `R-GITHUB-PLATFORM-DEPENDENCY`, and `R-SERVICENOW-DEPENDENCY` once Isak's gate is recorded |
| 6.4 | Update [`next-steps.md`](next-steps.md) and the [team brief](matrix-sync-brief-for-team.md) |

---

## The single most important line

**Run a synthetic incident through the production path before the first real one.** It costs ten minutes and, on the evidence of 2026-08-20, finds roughly three things that no test suite can.
