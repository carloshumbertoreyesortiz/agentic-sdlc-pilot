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

## `create-e11-issues.sh` (Rev 1.3, 2026-07-02)

Seeds the **E-11 epic + 18 stories (US-062…US-079)** covering the Telenor SFB
DevOps way-of-work integration per **BACKLOG-AGENTIC-SDLC-001 Rev 1.3**. It
created **#107** (E-11) + **#108…#125** (US-062…US-079), all linked as native
sub-issues of #107. Idempotent: re-runs skip existing issues via title-anchored
`in:title` lookups. Bash 3.2 clean per US-060.

**When to re-run:** only if E-11 stories are deleted, or if Rev 1.4+ adds new
stories.

### Bug 6 (US-E11-seed, 2026-07-02): pipefail + `grep -q` + `gh` SIGPIPE race

Under `set -o pipefail`, `gh label list | grep -qxF LABEL` returns exit 141
(SIGPIPE) when `grep` exits early after finding the label; `gh` then fails
writing to the now-closed pipe. The pipeline status of 141 causes `if !` to read
a **present** label as **missing**, intermittently (timing-dependent on `gh`
flush vs `grep` short-circuit — successive runs falsely flagged different early
labels, `story` then `epic`).

**Fix applied:** fetch the label list once into a variable; use a case-statement
membership test with no pipe. See the preflight block in `create-e11-issues.sh`
(search for `EXISTING_LABELS`).

Not caught by `bash -n` or `shell-lint` because it's a runtime race, not a syntax
issue. Not caught by the pre-flight because that container's `gh` flushed before
`grep`'s SIGPIPE registered.

**Standing rule reinforced:** pre-flight under bash 3.2 syntactically is
necessary but not sufficient — runtime pipe behaviour must be tested against a
real repo before delivery.

## `create-e11-fields.sh` (US-062)

Creates the Telenor SFB **GitHub Project custom fields** (Priority, Size, Type,
Sub Epic, Business Area, Business Analyst, External Reference Type/Id/URL, SFB
Case Number, Caller, Alternate Contact) on the pilot's ProjectV2 via
`gh api graphql`. Idempotent (skips existing fields via the same pipe-free
membership check as Bug 6) and re-fetch-and-asserts each field after creation.

**Run by Carlos (Project owner) — not an agent.** ProjectV2 mutations require
Project-admin permission; an agent token cannot create fields.

```
./tools/create-e11-fields.sh [owner-login] [project-number]   # defaults: carloshumbertoreyesortiz 1
```

**Limitations, by design:**
- **Sprint (iteration) is not created** — the GraphQL `createProjectV2Field`
  mutation has no `ITERATION` dataType. Create it in the Project UI (US-064).
- **External References** is modelled as three fields (Type single-select + Id +
  URL text), since ProjectV2 has no composite field type.
- **`Type`** is created as a Project single-select (US-062's documented fallback);
  native GitHub Issue Types can be set up separately in repo settings if preferred.
- Existing 60+ issues are **not** migrated — that is a separate Carlos-mediated
  pass with rollback (US-062 constraint).
