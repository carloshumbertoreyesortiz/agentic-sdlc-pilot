# Risk register

Living list of accepted/managed risks for the agentic-sdlc-pilot. Revisit at
the E-10 governance review (US-047).

| ID | Risk | Status | Mitigation / exit trigger | Evidence |
|----|------|--------|---------------------------|----------|
| R-01 | `enforce_admins=false` — repo admin can bypass required checks (incl. `agent-provenance`), so the gate is advisory for admins while the repo is solo-operated. | Accepted (Phase 0/1) | Flip to `enforce_admins=true` when a second collaborator is added; revisit at E-10 (US-047). | PR #62 (gate failed) / PR #63 (revert), 2026-06-10 |
| R-02 | Pilot repo is a **personal** repo (`carloshumbertoreyesortiz/agentic-sdlc-pilot`), not under `TelenorNorgeInternal` — outside org governance/SSO/audit. | Accepted (Phase 0/1) | Transfer into the org once an org owner grants repo-creation/transfer rights; revisit at E-10. | US-012 |
| R-03 | `agent-provenance` records are only as trustworthy as the writer; `token_cost` was a placeholder until the headless agent captured real usage. | Resolved 2026-06-11 | Headless planner (US-022) captures real `response.usage` into `token_cost` — demonstrated run `planner-1781169706092` (in=779, out=523, model claude-haiku-4-5). | US-022 / US-030 |
