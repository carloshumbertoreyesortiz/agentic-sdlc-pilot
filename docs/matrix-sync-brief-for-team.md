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

## What's left before we can test

1. **Firewall opening** — **ordered by Halvor**, now waiting on approval from the owners of Telenor's GitHub system.
2. **A secure "GitHub App"** for the production repo. Telenor's rules require this instead of personal tokens. Carlos has requested it via the platform team (#nova-github).

Both are with the **same part of Telenor** — the GitHub platform side — and **nothing can be tested until they land**. That's the honest status: the work is understood and agreed, it's the approvals we're waiting on.

## What we still need — and from whom

| Who | What we're asking | Why it matters |
| --- | --- | --- |
| **Carlos** | Chase the **GitHub App** and the **firewall approval** | These are the only things blocking a first test |
| **Halvor** | Build the **queue + sending job**; confirm a few small design points | This is the engine that moves incidents |
| **Isak Charrad** | Confirm the **service-desk data isn't sensitive**; decide whether our updates go to **work notes** (internal) rather than comments the reporter sees | A governance gate, and it keeps engineering chat away from customers |
| **Ingrid** | Show us **which incidents you sync by hand today** — your choices define what the automation should pick up; later, confirm a test run matches what you'd have done | Without this, we'd be guessing at scope |
| **Martin** | Join a **30-minute session** to agree how incident fields map to GitHub | This is what makes incidents flow automatically |

## Timing

- **Now:** waiting on the firewall approval and the GitHub App — both with Telenor's GitHub platform team.
- **Meanwhile:** we're building and testing our receiving end with sample data, so it's ready the moment the door opens.
- **August:** a 30-minute field-mapping session with Martin, Isak, and Ingrid as needed.
- **After that:** test on a few safe incidents, then switch on. The manual daily task retires.

## In one sentence

The design is agreed and simpler than before — Matrix does the talking, so nothing reaches into Telenor's network — and we're now waiting on **two GitHub-side approvals** before the first test can run.

_Questions? Reply to Carlos any time._
