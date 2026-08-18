# Matrix ↔ GitHub Sync — Short Brief for the Team

_From: Carlos Reyes · updated 10 August 2026_
_A plain-language summary you can read in a minute. A fuller technical version lives in the pilot repo (`docs/technical-next-steps-matrix-sync.md`) for anyone who wants the detail._

## What this is about

Today, incidents are moved between **Matrix (ServiceNow)** and **GitHub** by hand — Ingrid does this manually, every day. It's the most vulnerable single-person task in the workflow: if she's unavailable, the sync stops.

The pilot automates this. Once it's switched on, the manual daily task goes away, and the "only one person can do this" risk drops from **1 to 0**.

This is the **SFB team's integration** (ticket #1595) — Martin owns it, Carlos is the technical contact. The pilot conforms to your side; it doesn't take it over.

## The design got simpler — and safer (10 August) ✅

The 5 August plan had GitHub reaching into Matrix. That would have meant asking the network team to open the door for **thousands of constantly-changing internet addresses** — unworkable, and nobody's idea of good security.

**So we turned it around: Matrix does all the talking.** It sends incident updates out to GitHub and checks GitHub for replies. Nothing ever reaches *into* Telenor's network. One narrow opening outward, nothing inward.

That simplified several things at once:
- **No integration user needed in Matrix** — Halvor's internal job does the sending, so there's no extra account to create or look after.
- **Halvor is building a queue** — every update becomes a record in a list that gets sent, retried if it fails, and reported on if it fails for good. Nothing is lost silently, and there's an audit trail. This is a pattern his team already uses elsewhere.
- **A daily full check** on top of that, so if anything ever slips through the gaps, it's caught the next day rather than never.
- **The two systems will know each other's records**, so an incident and its GitHub issue stay linked and we never create duplicates.

## The door is open — and tested ✅

**The firewall opening went live on 13 August**, ordered on the 10th and approved by Telenor's GitHub system owners within three days. On the 14th Halvor **tested it from ServiceNow and got a clean response** — so this isn't a paper confirmation, the two systems can genuinely reach each other.

That was the last approval standing between us and a first test. **Testing can now go ahead** using a sandbox repository, which needs no further permissions from anyone.

One item remains, but it no longer holds anything up: a secure **"GitHub App"** for the *production* repository, which Telenor's rules require instead of personal tokens. Carlos has that request running with the platform team (#nova-github). It's needed before we switch on for real — not before we test.

## What we still need — and from whom

| Who | What we're asking | Why it matters |
| --- | --- | --- |
| **Carlos** | Get the **test credential** to Halvor; publish the **field-mapping contract** so he knows exactly what to send; keep the **GitHub App** moving for production | So nothing waits on us when Halvor picks this back up |
| **Halvor** | Build the **queue + sending job**; confirm a few small design points | This is the engine that moves incidents |
| **Isak Charrad** | Confirm the **service-desk data isn't sensitive**; decide whether our updates go to **work notes** (internal) rather than comments the reporter sees | A governance gate, and it keeps engineering chat away from customers |
| **Ingrid** | Show us **which incidents you sync by hand today** — your choices define what the automation should pick up; later, confirm a test run matches what you'd have done | Without this, we'd be guessing at scope |
| **Martin** | Join a **30-minute session** to agree how incident fields map to GitHub | This is what makes incidents flow automatically |

## Timing

- **Now:** the connection is open. Halvor builds the sending side; in parallel we're writing down exactly which incident field becomes which part of a GitHub issue, so he isn't guessing.
- **August:** a 30-minute field-mapping session with Martin, Isak, and Ingrid as needed.
- **Then:** test on a few safe incidents in a sandbox, then switch on for real once the production GitHub App is approved. The manual daily task retires.

## In one sentence

The design is agreed and simpler than before — Matrix does the talking, so nothing reaches into Telenor's network — the connection is **now open**, and the first test needs only the sending job Halvor is building.

_Questions? Reply to Carlos any time._
