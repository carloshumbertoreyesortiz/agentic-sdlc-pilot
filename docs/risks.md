# Risk register

Living list of accepted/managed risks for the agentic-sdlc-pilot. Revisit at
the E-10 governance review (US-047).

| ID | Risk | Status | Mitigation / exit trigger | Evidence |
|----|------|--------|---------------------------|----------|
| R-01 | `enforce_admins=false` — repo admin can bypass required checks (incl. `agent-provenance`), so the gate is advisory for admins while the repo is solo-operated. | Accepted (Phase 0/1) | Flip to `enforce_admins=true` when a second collaborator is added; revisit at E-10 (US-047). | PR #62 (gate failed) / PR #63 (revert), 2026-06-10 |
| R-02 | Pilot repo is a **personal** repo (`carloshumbertoreyesortiz/agentic-sdlc-pilot`), not under `TelenorNorgeInternal` — outside org governance/SSO/audit. | Accepted (Phase 0/1) | Transfer into the org once an org owner grants repo-creation/transfer rights; revisit at E-10. | US-012 |
| R-03 | `agent-provenance` records are only as trustworthy as the writer; `token_cost` is a placeholder until the headless agent captures real usage (US-022/US-030). | Open | Wire real token/tool/prompt capture in E-05/US-022. | US-030 |
