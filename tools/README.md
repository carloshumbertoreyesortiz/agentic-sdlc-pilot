# tools/ — backlog seeder scripts

One-shot scripts that seeded this repo's GitHub Issues backlog. Committed under
**US-061** so that (a) CI `shell-lint` covers them, (b) changes go through the
normal PR + gate flow, and (c) `git log` alone answers *"what created our
backlog?"*.

> Every script here MUST stay `bash -n` clean under `/bin/bash` (macOS ships
> bash 3.2 as the floor) per **CLAUDE.md → Hard rules → Shell scripts** (US-060).
> The CI `shell-lint` step (`.github/workflows/check.yml`) enforces it.

## `create-issues.sh`

Seeded the **original backlog** — 10 epics (E-01…E-10) + 47 stories
(US-001…US-047), 17 labels, 3 milestones — on **2026-06-09**.

Run **directly** against the repo; this predates the repo's own PR/CI flow, so
there is no "run PR" — the seeded issues themselves (created 2026-06-09) are the
evidence. Uses the bash-3.2-safe `create_issue` helper (body read from stdin via
`body=$(cat)`, with the heredoc on the call line — never `$(cat <<EOF)`).

## `add-step0-issues.sh`

Seeded **Epic E-00 (DevOps AI Capture Layer) + 8 stories (US-052…US-059)** and
superseded US-038, on **2026-06-19** — companion to the §00.5 capture-layer
chapter (PR #88). It created issues **#89–#97** and superseded **US-038**
(#48 closed; equivalent work tracked under US-054, #92).

**This is the CORRECTED version, not the one originally delivered.** The original
had three defects, all surfaced during the run ("Gate C") and fixed before this
commit:

1. **Heredoc inside `$(…)`** → failed to parse under macOS bash 3.2. Fixed by
   adopting the `create_issue` stdin-heredoc helper (mirrors `create-issues.sh`).
2. **`set -u` unbound `$E00_NUM`** during the epic create → fixed with a pre-init
   (`E00_NUM=""`).
3. **Free-text `gh issue list --search '"US-038"'`** matched **US-054** (whose
   title reads "replaces US-038") and closed the wrong issue. Fixed to a
   title-anchored lookup (`US-038 in:title` + `test("\[STORY\] US-038:")`). The
   mis-close was remediated live (US-054 reopened; the real US-038 #48 closed).

The original buggy version is intentionally **not** committed — only this
corrected form. The bug history is documented here (US-061), not preserved as a
wrong-direction file in git.
