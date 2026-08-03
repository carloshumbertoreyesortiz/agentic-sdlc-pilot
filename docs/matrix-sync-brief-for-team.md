# Matrix ↔ GitHub Sync — Short Brief for the Team

_From: Carlos Reyes · 3 August 2026_
_A plain-language summary you can read in a minute. A fuller technical version lives in the pilot repo (`docs/technical-next-steps-matrix-sync.md`) for anyone who wants the detail._

## What this is about

Today, incidents are moved between **Matrix (ServiceNow)** and **GitHub** by hand — Ingrid does this manually, every day. It's the most vulnerable single-person task in the workflow: if she's unavailable, the sync stops.

The pilot has built the GitHub side to **automate this**. Once it's switched on, the manual daily task goes away, and the "only one person can do this" risk drops from **1 to 0**.

Important: this is the **SFB team's integration** (ticket #1595). The pilot doesn't take it over — it only reads from ServiceNow and handles the GitHub side. Ownership stays with your team.

## The one thing blocking us right now

We can't connect to Matrix at all yet:
- The Matrix site (`https://matrix.telenor.no/`) does **not load**, even on a fresh VPN session.
- The access-request (AIR catalog) page does **not open** either.

This looks like a **base access** gap — a level below the AIR service-account role we ultimately need. So it needs someone to **sponsor the base Matrix access request** first.

## What we need — and from whom

| Who | What we're asking | Why it matters |
| --- | --- | --- |
| **Halvor / Julie** | Sponsor the **base Matrix access** request (and then the AIR service-account role) | Nothing can start until we can reach Matrix |
| **Isak Charrad** | Review the technical doc at your own pace; help define **how incidents are noted and closed** | So the automation matches the real process, not just the fields |
| **Martin** | A **30-minute session** to agree how incident fields map to GitHub, plus the ServiceNow-side trigger | This is what makes incidents flow automatically |
| **Ingrid** | Confirm a test run matches what you'd do by hand | Final check before we go live |

## Timing

- **Now:** we just need the **base Matrix access** sponsored so it isn't stuck (ideally before anyone heads off on holiday).
- **August:** a 30-minute working session (when Halvor is back), with Isak, Ingrid, and Martin as needed.
- **After that:** we connect, test on a few safe incidents, and switch it on. The manual daily task retires.

## In one sentence

Everything on the pilot side is built and waiting — **the single thing we need to move forward is base access to Matrix.**

_Questions? Reply to Carlos any time._
