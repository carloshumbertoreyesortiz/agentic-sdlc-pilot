# Matrix ↔ GitHub Sync — Short Brief for the Team

_From: Carlos Reyes · updated 5 August 2026_
_A plain-language summary you can read in a minute. A fuller technical version lives in the pilot repo (`docs/technical-next-steps-matrix-sync.md`) for anyone who wants the detail._

## What this is about

Today, incidents are moved between **Matrix (ServiceNow)** and **GitHub** by hand — Ingrid does this manually, every day. It's the most vulnerable single-person task in the workflow: if she's unavailable, the sync stops.

The pilot automates this. Once it's switched on, the manual daily task goes away, and the "only one person can do this" risk drops from **1 to 0**.

This is the **SFB team's integration** (ticket #1595) — Martin owns it, Carlos is the technical contact. The pilot conforms to your side; it doesn't take it over.

## Where we are now — good progress at the 5 August meeting ✅

We agreed the approach with Halvor and Martin:
- **A dedicated integration user** (a non-personal service account) — Halvor will set this up. *Not* the AIR role (that's for people reporting incidents). Carlos doesn't need personal Matrix access.
- **A custom, secure connection built just for us**, scoped to only the incidents relevant to the pilot plus their work notes — nothing more.
- **Simple, standard authentication** (basic auth or OAuth).

## Two setup requests are now in motion (both waiting on others)

1. **Firewall opening (Matrix → GitHub).** The connection runs directly between Matrix and GitHub. Carlos has sent Halvor the GitHub addresses to allow, and Halvor is ordering the opening — the network team's timing is the main unknown.
2. **A secure "GitHub App" for the production repo.** Telenor's rules require this (instead of personal tokens) for `TelenorNorgeInternal/s06065-sfb-telenor-sfdc`. Carlos has requested it via the platform team (#nova-github). We can start testing against a sandbox repo while this is approved.

## What we still need — and from whom

| Who | What we're asking | Why it matters |
| --- | --- | --- |
| **Halvor** | Order the **firewall opening** (has the GitHub addresses); finish the **integration user + connection** | Lets Matrix and GitHub talk |
| **Isak Charrad** | Confirm the **service-desk data isn't sensitive** (a quick governance check); help define how incidents are **noted and closed** | Green-lights our access + matches the real process |
| **Martin** | Join a **30-minute session** to agree how incident fields map to GitHub | This is what makes incidents flow automatically |
| **Ingrid** | Confirm a test run matches what you'd do by hand | Final check before we go live |

## Timing

- **Now:** firewall opening + GitHub App approval are in progress (waiting on the network team and the GitHub platform team).
- **August:** a 30-minute field-mapping session with Martin, Isak, and Ingrid as needed.
- **After that:** connect, test on a few safe incidents, switch it on. The manual daily task retires.

## In one sentence

The approach is agreed and two setup requests are moving — we're now waiting on the **firewall opening** and the **GitHub App approval** to start testing.

_Questions? Reply to Carlos any time._
