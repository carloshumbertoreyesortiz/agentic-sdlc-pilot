# Agent provenance

> Stories: **US-029** (schema), **US-030** (writer), **US-031** (CI gate), **US-032** (required check)
> Epic: **E-07** — Provenance & Compliance Workflow

Every agent-authored PR must carry `.agent/provenance.json` recording how the
change was produced. The `agent-provenance` GitHub Action (a required check on
`main`) fails any `agent/*` PR where the file is missing or invalid.

- **Schema:** [`provenance.schema.json`](provenance.schema.json) (JSON Schema draft-07)
- **Writer:** [`src/provenance.ts`](../src/provenance.ts) — `writeProvenance(path, record)`
- **Gate:** [`.github/workflows/agent-provenance.yml`](../.github/workflows/agent-provenance.yml)

## Required fields

| Field | Meaning |
|---|---|
| `run_id` | Unique id for the agent run |
| `task` | What the run was asked to do |
| `agent_identity` | Agent identity (distinct from any human) |
| `human_approver` | Human who approved the plan/PR (Checkpoint 1) |
| `model` | Model id, e.g. `claude-opus-4-8` |
| `started_at` / `finished_at` | ISO-8601 timestamps |
| `prompt_hash` | Hash of the system prompt used |
| `tool_trace` | Ordered list of tool invocations |
| `attachment_hashes` | SHA-256 of any ingested attachments |
| `token_cost` | `{ input, output }` token counts |

## Example

```json
{
  "run_id": "e07-provenance-2026-06-10",
  "task": "E-07: replace agent-provenance stub with a real gate",
  "agent_identity": "claude-code@agentic-sdlc-pilot",
  "human_approver": "carloshumbertoreyesortiz",
  "model": "claude-opus-4-8",
  "started_at": "2026-06-10T08:00:00Z",
  "finished_at": "2026-06-10T08:20:00Z",
  "prompt_hash": "sha256:…",
  "tool_trace": ["Read", "Write", "Bash"],
  "attachment_hashes": [],
  "token_cost": { "input": 0, "output": 0 }
}
```
