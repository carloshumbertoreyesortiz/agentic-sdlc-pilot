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

## 7 — Error Type was never in the contract

`Error Type = Functional Error` has not been mapped because it was never mentioned. Two steps: Halvor adds it to the payload, then the pilot decides where it lands. There is **no obvious home** on the production board — the natural candidates were dropped as unnecessary — so it may belong in the issue body, or as a label, or need a new field. Ingrid's call.

## What this test was worth

Twelve scenarios, of which **two were already fixed**, **four are unbuilt work with named owners**, **one is a scope decision**, and **one produced a real diagnosis** that would otherwise have surfaced as *"customers stopped getting emails"* weeks later with no obvious cause.

The single most valuable row is **9** — a predicted side effect, confirmed in production, with the fix already designed.
