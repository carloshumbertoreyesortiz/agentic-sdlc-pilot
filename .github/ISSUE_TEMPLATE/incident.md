---
name: Incident (Matrix)
about: A Matrix / ServiceNow-sourced incident (Flow C). Auto-populated by the #1595 sync once it ships; usable manually until then.
title: "📝INC0XXXXXX - "
labels: []
---

<!-- Matrix-sourced incident (Flow C, upstream #1595). Fields mirror #1595's mapping; source linkage uses the External References mechanism — see docs/way-of-work.md §7. Do not paste customer-identifying data. -->

## Fields (set on the Project item)

- **Type:** Incident
- **Sub Epic:** Matrix Defect
- **Priority:** P0 · P1 · P2 · P3 _(from the Matrix incident Priority)_
- **Size:** S · M · L
- **Sprint:** _leave blank — set at sprint planning_
- **External References:** Reference Type = `Matrix` · Reference Id = `INC0XXXXXX` · Reference URL = `https://matrix.telenor.no/…`

## Caller *(required)*

_The Matrix AIR user who reported the incident._

## Alternate Contact *(optional)*

_An alternate contact from the Matrix incident, if any._

## Description

_Short description and details carried from the Matrix incident._

## Error Type → Sub Epic

_The Matrix **Error Type** maps to **Sub Epic = Matrix Defect** (per #1595)._

## Attachments

_Matrix attachments are linked / mirrored per the #1595 sync rules. Do not paste customer-identifying information into this issue._
