# Matrix ↔ GitHub sync — acceptance test results

_Ingrid Marie Urdshals, 2026-09-04 · triaged by Carlos + Claude Code · US-075_
_Test incident: `INC0072796` → [#3098](https://github.com/TelenorNorgeInternal/s06065-sfb-telenor-sfdc/issues/3098)_

The first structured acceptance test, run against **production** by the person whose manual process the sync replaces. Her own framing: *"not a complete list but a start."*

## Triaged results

| # | Test | Her result | Triage | Owner |
| --- | --- | --- | --- | --- |
| 1 | Incident created in Matrix | ✅ | — | — |
| 2 | Email notification to requester | ✅ | — | — |
| 3 | GitHub issue created | ✅ | — | — |
| 4 | Linked to Project SFB | ❌ | ✅ **Now passes** — fixed after she tested | Done |
| 5 | Linked to the `'26` epic | ❌ | ✅ **Now passes** — same fix | Done |
| 6 | Issue number → Vendor Reference ID | ❌ | **Not built yet** — requested 09-04, same day | Halvor |
| 7 | Error Type → GitHub | ❌ | ⚠️ **New requirement** — never specified | Halvor, then pilot |
| 8 | Caller note visible from the list view | ⚠️ | **Not built yet** — the caller label | Pilot |
| 9 | Outbound comment → no requester email | ⚠️ | 🔍 **Diagnosed — see below** | Halvor |
| 10 | `[internal]` → Work Note | ✅ | — | — |
| 11 | Timestamps unreadable | ⚠️ | Fair | Halvor |
| 12 | Closing the issue doesn't update Matrix | ❌ | ⚠️ **Not a defect — deferred by agreement** | Decision |

## 9 — the missing requester notification is the business-rule suppression

Comments arrive in Matrix as Additional Comments correctly, but **the requester gets no email**. The likely cause is known, and was predicted:

Halvor's inbound write inserts the note **without triggering business rules**, which is what stops the sync echoing its own writes back to GitHub. But that suppression is **not selective** — it suppresses *every* rule on that insert, including the one that emails the requester when a comment is added.

This was flagged when the mechanism was chosen (2026-08-31): *"it does not suppress the sync's rule, it suppresses every rule on that insert… anything else the platform would normally do — SLA clocks, notifications, audit — silently does not happen, and nothing reports that it did not."*

**The fix is the one already planned:** move loop-breaking to the **dedicated user** — exclude outbound queue records authored by that account — and stop suppressing business rules. Targeted rather than blanket, so notifications and everything else behave normally.

⚠️ **And check what else went quiet.** The notification is the symptom that happened to be *visible*. SLA clocks, audit entries and any other rule on that table have been equally suppressed on every GitHub-originated note, with nothing reporting it.

## 12 — closure is deferred scope, not a broken feature

Closing the GitHub issue does not update the Matrix incident, because **that direction was never built.** Status push-back was deliberately parked on 2026-08-25 pending a decision on **who owns Status while an incident is in flight** — without one owner per field, both sides push and neither wins. Comments-only was the agreed starting scope.

Her test shows the deferred behaviour is **expected by the person using it**, which is the useful finding. The question returns: should GitHub-side state changes flow back, and who wins when both sides change at once?

_Note the asymmetry that makes this harder than it looks: comments carry an origin marker, so the loop is breakable. **Field changes carry nothing** — a Status change records no evidence of who set it — so loop prevention there rests entirely on comparing timestamps._

### ✅ Resolved 2026-09-04 — the ownership question was never contested

The deferral rested on *"who owns Status while an incident is in flight?"*, assuming the service desk and the developers might both change it. Ingrid's answer removes the premise:

> *"Developers working in GitHub do not have access to manually close incidents in Matrix, which creates a dependency on Martin or me… In practice, I have never experienced the Service Desk being actively involved in handling SFB incidents."*

So there is **no contention to arbitrate**. The people doing the work are in GitHub; the service desk is not involved beyond Isak's periodic reminders to tidy the backlog. **GitHub is the source of truth for the state of an SFB incident**, and the theoretical ping-pong the deferral guarded against does not occur.

### ⚠️ And this is not a nice-to-have — the story's own KPI depends on it

US-075 exists to move **key-person-risk from 1 to 0**. It currently does not:

| | Before the sync | Now | After closure push-back |
| --- | --- | --- | --- |
| Creating the GitHub issue | Ingrid, by hand | ✅ automatic | ✅ automatic |
| Keeping notes in step | Ingrid, by hand | ✅ automatic | ✅ automatic |
| **Closing the Matrix incident** | Ingrid or Martin, by hand | ❌ **still Ingrid or Martin** | ✅ automatic |

The sync has removed the creation toil and left the closure toil. Ingrid still has a manual task on every incident — a smaller one, but the dependency is intact, and **the KPI cannot honestly be reported as 0 until closure flows back.**

### Recommendation: closure only, not full status mirroring

Start narrow, because closure alone solves the stated pain and carries almost no risk:

- **It is the actual complaint** — the manual dependency is specifically about closing
- **It is terminal.** Once closed there is nothing left to ping-pong; full status mirroring is where loops live
- **It is low-frequency**, so a mistake is visible and correctable rather than a flood

Full state mirroring can follow if wanted, once closure has run for a while.

**Open question for Halvor, which decides the target state:** does Matrix **auto-close Resolved incidents after a period**? Many ServiceNow instances do.

- If **yes** → set **Resolved** on issue closure. The caller still gets their confirmation window, and the incident closes itself. The manual dependency disappears entirely.
- If **no** → setting Resolved merely *moves* the manual step rather than removing it, and we should set **Closed** directly.

### ✅ Full closure design — Ingrid, 2026-09-04

| Step | Behaviour |
| --- | --- |
| Developer closes the GitHub issue | Matrix incident → **Resolved** (not Closed) — preserves the caller's approval step |
| Caller **accepts** | Note added to the GitHub issue recording acceptance |
| Caller **rejects** | Note added, **and the GitHub issue is reopened** for further work |
| Caller does neither | Matrix auto-closes Resolved → Closed after *n* days — **unverified**, see below |

**Most of this already exists in the contract.** Worth noting so nobody rebuilds it:

- **Accept** → the incident moves Resolved → Closed, which already maps to Status `Done` + closing the issue. The explicit note is an addition; the state flow is specified.
- **Reject** → Resolved → Work in Progress, which is the `Closed → reopened` case added on 2026-08-28: `state: "open"` with `state_reason: "reopened"`.

### ⚠️ One edge case that would undo the developer's action

The sequence *GitHub closes → Matrix sets Resolved → Matrix pushes state back to GitHub* has a trap. `Resolved` maps to **"issue state unchanged"**, and the mapping table records that as *"stays open"* — wording written when the issue was always already open.

Read literally as *"ensure the issue is open"*, ServiceNow would send `state: "open"` and **reopen the issue the developer closed moments earlier**, on the next two-minute poll. The developer closes it; it reopens itself; nobody understands why.

**Precisely: for `Resolved`, send _no_ `state` field at all** — not `state: "open"`. Only `Closed`, `Cancelled` and the reopen-after-reject cases carry a state value. The distinction is between *"leave it as it is"* and *"make it open"*, which is invisible in the phrase "stays open" and consequential.

### Verifying the auto-close — Ingrid's test

Whether Matrix already closes Resolved incidents after *n* days is the one unknown, and she has proposed an empirical check rather than asking anyone: **watch `INC0069636`**, resolved 2026-08-24 and not user-accepted. If the automation works it should close on its own.

Better than asking, since what matters is whether it *does* happen, not whether it is *configured* to. _(If it does not fire, closure push-back sets `Resolved` and leaves the manual step in place — so this test decides whether the key-person dependency actually reaches zero.)_

## 7 — Error Type: ✅ decided — the issue body

Ingrid, 2026-09-04: *"included directly in the GitHub issue description/body… developers get the context without referring back to Matrix."*

The right answer, and the cheapest: it joins the other Background fields Halvor already emits, needs no board field, no schema change and no decision from anyone else. Halvor's side only.

## What this test was worth

Twelve scenarios, of which **two were already fixed**, **four are unbuilt work with named owners**, **one is a scope decision**, and **one produced a real diagnosis** that would otherwise have surfaced as *"customers stopped getting emails"* weeks later with no obvious cause.

The single most valuable row is **9** — a predicted side effect, confirmed in production, with the fix already designed.
