---
name: Story / Task
about: A change with meaningful scope (Story) or a minor change / clean-up (Task).
title: "[Story] "
labels: []
---

<!-- Telenor SFB way-of-work: docs/way-of-work.md §6 (Type + Sub Epic). Set the Project fields below on the issue's Project item. Change the title prefix to [Task] if Type = Task. -->

## Fields (set on the Project item)

- **Type:** Story _or_ Task — **Story** = meaningful scope; **Task** = minor change / clean-up
- **Sub Epic:** Clean-Up · New Feature · Minor Improvements and Bug Fixes · Major Improvements and Bug Fixes
- **Priority:** P0 · P1 · P2 · P3
- **Size:** S · M · L
- **Sprint:** _leave blank — set at sprint planning_

## Description

_What is changing, and why._

## Acceptance criteria

_Required for **Type = Story**; optional for **Type = Task** (a Task needs a description only)._

- [ ] …
- [ ] …

## UAT documentation

<!-- US-067: the CP2 → CP3 (deploy) gate requires every acceptance criterion above
to be tested and documented HERE before the change is promoted to production
(Status → Ready for Deployment). Fill this in during UAT; leave blank until then. -->

_Business Analyst records, per acceptance criterion: scenario tested · result (pass/fail) · date · tester. When all pass, set the provenance `uat_documented=true` and `uat_evidence_url` (link to this section) — the agent-provenance gate blocks CP3 otherwise._

| Acceptance criterion | Scenario tested | Result | Date | Tester |
| --- | --- | --- | --- | --- |
| … | … | ⬜ | | |
