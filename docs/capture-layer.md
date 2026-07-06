# §00.5 — Capture Layer setup

> **Companion to:** IMPL-AGENTIC-SDLC-001 Rev 1.5, ARCH-AGENTIC-SDLC-001 Rev 1.6
> **Tracks:** Epic E-00 (US-052 through US-059)
> **Audience:** Pilot squad engineers + the org admins who own the source systems
> **Status:** Capability layer (always-on) — not a phase. Set up before §01 Terminal prep where possible; some channels need external admin coordination, so raise those tickets early.

This chapter precedes §01 (Mac Terminal Preparation) in the implementation guide. Its purpose is to wire up the **intake plumbing** before any agentic SDLC work begins. The capture layer is how requirements — wherever they natively arise (a Teams meeting, a Confluence page, a Jira ticket, a Slack thread, your VS Code window, your terminal) — become traceable `NormalizedIntake` records that flow into the planning agent.

You don't need all six channels working before you start §01. Set up at least the **self-serve pair** (VS Code Command Palette + Terminal CLI — §00.5.5 and §00.5.6) immediately. The four admin-gated channels (Teams, Slack, Confluence, Jira) can be raised as parallel tickets and the squad continues working with whichever channels land first. The system is operable per-channel; a missing channel just means that source isn't an intake path for that team.

---

## §00.5.0 — Overview: capture channels

| Channel | Source | Who sets it up | Capture trigger |
|---|---|---|---|
| **Teams** | Microsoft Teams meeting transcripts | M365 admin | Meeting with `[agentic]` in subject ends |
| **Slack** | Slack messages | Slack workspace admin | `@-mention` of the agentic bot |
| **Confluence** | Confluence pages | Confluence space admin | Page published or edited (5-min poll) |
| **Outlook** | Email intake (~50% of SFB requirements arrive by email — Ingrid 2026-06-30) | M365 admin | Email to / forwarded to the agentic mailbox |
| **VS Code** | Highlighted text in any file | Engineer (self-serve) | Command Palette → "Agentic: Send Selection" |
| **Terminal CLI** | Anything you can pipe to stdin | Engineer (self-serve) | `agentic capture` command |
| **Salesforce** _(Flow B)_ | SFB TCR Cases | Upstream — SFB team (#1121) | Pilot **receives** SF-sourced issues; sync owned by #1121, not implemented here |
| **Matrix / ServiceNow** _(Flow C)_ | Matrix incidents (`matrix.telenor.no`) | Upstream — SFB team (#1595); AIR role per KB0010037 | Pilot **receives** Matrix-sourced issues; sync owned by #1595 (see US-075) |
| ~~**Jira**~~ | Jira tickets and comments | Jira project admin | **Deprecated for the SFB context** (SFB uses Salesforce/Matrix, not Jira); schema support retained for other teams |

These channels produce the same `NormalizedIntake` shape, so downstream agents are channel-agnostic. The schema is defined in **§00.5.0a** below.

> **Channel-set reconciliation (US-069).** The original E-00 set was six self-hosted capture channels. Ingrid's 2026-06-30 email described the SFB reality as **three intake flows**: Flow A (larger initiatives via meetings/dialogue — Teams, Slack, Confluence, Outlook), Flow B (SFB TCR Cases via Salesforce/#1121), Flow C (defects via Matrix/#1595). So **Outlook** is added (email is ~50% of intake), **Salesforce** and **Matrix** are added as upstream-owned *receive* channels (the pilot consumes; it does not implement those syncs), and **Jira** is deprecated for SFB (retained for other teams). See the E-00 ↔ three-flow mapping in [way-of-work.md](way-of-work.md) §1.

### §00.5.0a — The NormalizedIntake schema

Every capture, regardless of source, produces a record like this:

```typescript
// src/capture/normalized.ts — committed source of truth
export type CaptureSource =
  | "teams"
  | "slack"
  | "confluence"
  | "outlook"        // US-069: email intake (Flow A)
  | "salesforce"     // US-069: SFB TCR Cases (Flow B, upstream #1121 — receive-only)
  | "matrix"         // US-069: Matrix/ServiceNow incidents (Flow C, upstream #1595 — receive-only)
  | "jira"           // deprecated for SFB (retained for other teams)
  | "vscode"
  | "cli";
// NOTE: this is the documented source-of-truth. The committed code type is
// delivered by US-052 (#90, still open) and MUST carry these same values,
// including the US-069 additions (outlook, salesforce, matrix).

export interface NormalizedIntake {
  source: CaptureSource;
  source_ref: string;                   // teams-meeting-id, slack-ts, conf-page-id+version, jira-issue-key, file-path:line-range, cwd+timestamp
  author: { name: string; email: string };
  captured_at: string;                  // ISO 8601 UTC
  text: string;                         // the requirement, normalized to plain text
  attachments: Attachment[];            // reuses Attachment from src/slack/bot.ts (US-040), do not redefine
  trust: "untrusted";                   // ALWAYS — same security boundary as US-023
  context?: {
    meeting_title?: string;
    channel?: string;
    ticket_id?: string;
    file_path?: string;
    [k: string]: unknown;
  };
}
```

JSON Schema is generated and committed at `docs/normalized-intake.schema.json` — that's the artifact the validation in §00.5.7 checks against.

**Why `trust: "untrusted"` is hardcoded:** captured text can contain prompt-injection payloads — a Confluence page might embed `Ignore previous instructions and ...`, a Jira ticket comment might do the same. The capture layer never declares anything trusted. Downstream agents apply the US-023 wrapping (`<untrusted_input>...</untrusted_input>` framing in the system prompt) before any of this text reaches the model.

---

## §00.5.1 — Teams meeting transcript capture (US-053)

**Owner:** Telenor M365 administrator (you'll raise a ticket; you can't self-serve this).
**External dependency:** Microsoft Graph API permissions, OnlineMeetingTranscript.Read.All and User.Read.All.
**Privacy note:** opt-in only via `[agentic]` tag in meeting subject. Default-deny on everything else, even meetings the bot is technically subscribed to.

### Steps

1. **Raise the M365 admin ticket** with this template (paste-ready):

   > Requesting registration of an Azure AD application for the Agentic SDLC pilot (ARCH-AGENTIC-SDLC-001, internal program).
   > Required Microsoft Graph application permissions: `OnlineMeetingTranscript.Read.All`, `User.Read.All`.
   > Scope: only meetings tagged `[agentic]` in the subject (opt-in). Tenant: telenor.onmicrosoft.com (or applicable).
   > Will be webhook-subscribed via `subscriptions` resource for `callTranscript` updated events.
   > Contact: Carlos Reyes, agentic-sdlc-pilot owner.

2. **Receive the app credentials** (client_id, client_secret, tenant_id). Store the secret in Keychain per §03.3 pattern (same approach as `ANTHROPIC_API_KEY`):

   ```bash
   security add-generic-password -a "$USER" -s TEAMS_CLIENT_SECRET -w 'paste-here'
   security add-generic-password -a "$USER" -s TEAMS_CLIENT_ID -w 'paste-here'
   security add-generic-password -a "$USER" -s TEAMS_TENANT_ID -w 'paste-here'
   ```

3. **Create the webhook subscription** (one-time, via the agentic CLI when US-058 is ready, or manually via curl until then):

   ```bash
   curl -X POST https://graph.microsoft.com/v1.0/subscriptions \
     -H "Authorization: Bearer $TEAMS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "changeType": "created,updated",
       "notificationUrl": "https://<your-capture-endpoint>/teams/webhook",
       "resource": "/communications/callRecords?$filter=startswith(subject,'\''[agentic]'\'')",
       "expirationDateTime": "<now+72h>",
       "clientState": "<random-uuid-for-validation>"
     }'
   ```

4. **Verify with a test meeting:** schedule a 2-minute Teams meeting with `[agentic] capture test` in the subject. Record it. Have one participant say "We need to fix the CSV export so newlines inside quoted fields work properly." End the meeting. Within 90 seconds, you should see a `NormalizedIntake` arrive in your capture log:

   ```bash
   tail -f ~/.agentic/capture.log
   # Expect a line like:
   # {"source":"teams","source_ref":"AAMkADc...","author":{...},"text":"We need to fix..."}
   ```

5. **Close US-053** with the test meeting recording link as evidence.

### Acceptance check

- [ ] Webhook subscription returns a `subscriptionId`
- [ ] Test meeting produces a NormalizedIntake within 90 seconds of meeting end
- [ ] Non-tagged meetings produce nothing (opt-in verified)
- [ ] Subscription renewal cron in place (Microsoft Graph requires renewal every 72 hours)

---

## §00.5.2 — Slack message capture (US-054, supersedes US-038)

**Owner:** Slack workspace admin.
**External dependency:** Slack app installed in the Telenor workspace with `app_mentions:read`, `chat:write`, `files:read`, `users:read`, `users:read.email`.

**Important:** this story supersedes the original US-038 (Slack app registration, which was originally scoped under E-09). E-09 stays focused on Slack-as-checkpoint-channel (the three approval flows for plan / PR / deploy). **E-00 / US-054** is Slack-as-intake-channel. Same Slack app, two distinct surfaces.

### Steps

1. **Raise the Slack workspace admin ticket** (paste-ready):

   > Requesting registration of a Slack app for the Agentic SDLC pilot (ARCH-AGENTIC-SDLC-001).
   > App name: `agentic-sdlc-pilot`.
   > Required OAuth scopes: `app_mentions:read`, `chat:write`, `files:read`, `users:read`, `users:read.email`.
   > Event subscriptions: `app_mention`, `message.channels` (for channels where the app is invited).
   > Two surfaces: intake (this request, E-00 / US-054) and human-checkpoint flows (E-09).
   > Contact: Carlos Reyes.

2. **Receive bot token and signing secret.** Store both in Keychain:

   ```bash
   security add-generic-password -a "$USER" -s SLACK_BOT_TOKEN -w 'xoxb-...'
   security add-generic-password -a "$USER" -s SLACK_SIGNING_SECRET -w '...'
   ```

3. **Install the bot in your test channel** (`#agentic-pilot-test` or similar).

4. **Verify with a test mention:**

   In Slack, in the test channel, type:
   ```
   @agentic-sdlc-pilot please capture: the CSV export needs to handle RFC 4180 escaping
   ```

   Within 30 seconds, you should see the NormalizedIntake arrive with `source: "slack"`, `source_ref` set to the message timestamp, and `text` containing the requirement.

5. **Close US-054** (which by closing also retires US-038 with a "superseded" comment).

### Acceptance check

- [ ] Slack app installed in the workspace
- [ ] Bot responds to @-mention in test channel with a brief acknowledgment
- [ ] NormalizedIntake produced within 30 seconds of the mention
- [ ] `docs/slack.md` updated to document the two surfaces (intake vs checkpoint)

---

## §00.5.3 — Confluence page capture (US-055)

**Owner:** Confluence space admin (one per requirement-bearing space).
**External dependency:** API token with read access to designated spaces.
**Architecture note:** Confluence Cloud webhooks require an enterprise add-on Telenor may not have provisioned. Default approach is **5-minute polling**, which is fine for documents that change on human time-scales. Verify with admin whether webhooks are available before assuming push.

### Steps

1. **Identify the requirement-bearing spaces.** Talk to the PMs and tech leads — which Confluence spaces actually hold requirements vs which are dev notes / runbooks. The watcher should subscribe to the former only (least privilege).

2. **Generate an API token** at `id.atlassian.com/manage-profile/security/api-tokens`. Scope: read-only on the identified spaces. Store in Keychain:

   ```bash
   security add-generic-password -a "$USER" -s CONFLUENCE_API_TOKEN -w 'paste-here'
   ```

3. **Configure the watcher** in `config/capture-sources.yaml`:

   ```yaml
   confluence:
     enabled: true
     base_url: https://telenor.atlassian.net/wiki
     poll_interval_seconds: 300
     spaces:
       - key: PROD
         label: Product requirements
       - key: ARCH
         label: Architecture specs
     auth:
       email: carlos.reyes@telenor.com
       token_keychain_ref: CONFLUENCE_API_TOKEN
   ```

4. **Start the watcher** (the agentic CLI runs it as a background process once US-058 is in place; until then, run manually):

   ```bash
   agentic watch confluence --once     # one-off pull for testing
   agentic watch confluence --daemon   # background, polls every 5 min
   ```

5. **Verify with a test page.** Create or edit a page in the test space with content like:

   > # Requirement: CSV export RFC 4180 compliance
   > The current export produces invalid CSV when fields contain newlines. Need to fix per RFC 4180.

   Within 6 minutes (one poll cycle), a NormalizedIntake should arrive with `source: "confluence"`, `source_ref` set to the page ID + version.

### Acceptance check

- [ ] Watcher polls successfully (verify in `tail -f ~/.agentic/capture.log`)
- [ ] Test page produces a NormalizedIntake within 6 minutes
- [ ] De-duplication works: editing the same page twice within an hour produces ONE capture, not two
- [ ] Spaces not in the config produce nothing

---

## §00.5.4 — Jira ticket capture (US-056)

**Owner:** Jira project admin.
**External dependency:** API token with read access to designated projects. **Webhooks are natively supported in Jira Cloud**, so this is push (faster than Confluence).

### Steps

1. **Identify the requirement-bearing projects** (e.g., `PILOT`, `AGENTIC`).

2. **Generate the API token** — same Atlassian flow as §00.5.3. You can reuse the same token if the Atlassian account has both Jira and Confluence access; otherwise create a separate one:

   ```bash
   security add-generic-password -a "$USER" -s JIRA_API_TOKEN -w 'paste-here'
   ```

3. **Register the webhook in Jira** (via UI: Settings → System → WebHooks, or via REST API):

   ```bash
   curl -X POST https://telenor.atlassian.net/rest/webhooks/1.0/webhook \
     -u "carlos.reyes@telenor.com:$JIRA_API_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "agentic-sdlc-pilot capture",
       "url": "https://<your-capture-endpoint>/jira/webhook",
       "events": ["jira:issue_created", "comment_created"],
       "filters": { "issue-related-events-section": "project = PILOT OR project = AGENTIC" }
     }'
   ```

4. **Configure the handler** in `config/capture-sources.yaml`:

   ```yaml
   jira:
     enabled: true
     base_url: https://telenor.atlassian.net
     projects: [PILOT, AGENTIC]
     comment_strategy: append    # appends to existing capture timeline for the same issue
     auth:
       email: carlos.reyes@telenor.com
       token_keychain_ref: JIRA_API_TOKEN
   ```

5. **Verify with a test ticket.** Create a ticket in the test project with a real-feeling requirement in the description. Within 30 seconds, a NormalizedIntake should arrive with `source: "jira"`, `source_ref: "PILOT-<n>"`. Comment on the same ticket — that should *append* to the existing timeline, not create a new capture.

### Acceptance check

- [ ] Webhook returns 200 OK on registration
- [ ] Test ticket creation produces NormalizedIntake within 30 seconds
- [ ] Comment on the same ticket appends to the existing timeline, not a new record
- [ ] Tickets in non-watched projects produce nothing

---

## §00.5.5 — VS Code Command Palette capture (US-057)

**Owner:** Engineer (self-serve — no admin needed once the extension is on the team's private feed).
**Depends on:** US-058 (the local CLI must be installed first — the extension posts to it).

### Steps

1. **Install the extension from the team's private feed:**

   ```
   Cmd+Shift+P → "Extensions: Install from VSIX..." → select telenor-agentic-capture-X.Y.Z.vsix
   ```

   Or, if your VS Code is configured with the private extension registry, just search for `telenor-agentic-capture` in the Extensions sidebar.

2. **Verify the extension is active.** Open the Command Palette (`Cmd+Shift+P`) and start typing `Agentic`. You should see two commands:
   - `Agentic: Send Selection to Platform`
   - `Agentic: Send Active File`

3. **Verify the connection to the local CLI** (which must be running per §00.5.6). The extension's status bar item should read `Agentic ✓` in green. If it reads `Agentic ✗` red, the CLI daemon isn't running — install it first per §00.5.6.

4. **Test the capture:**
   - Open any file (a spec, an email saved as `.txt`, a Jira ticket pasted into a scratch file).
   - Highlight a passage that reads like a requirement.
   - `Cmd+Shift+P → "Agentic: Send Selection"`.
   - A toast notification confirms `Capture submitted: cap-<id>`.
   - Check `tail -f ~/.agentic/capture.log` — a NormalizedIntake with `source: "vscode"` should appear within 5 seconds.

5. **Close US-057** with the captured ID as evidence.

### Acceptance check

- [ ] Extension installed and status bar shows `Agentic ✓`
- [ ] Both commands visible in Command Palette
- [ ] Sending a selection produces NormalizedIntake within 5 seconds
- [ ] `source_ref` includes file path and line range

---

## §00.5.6 — Terminal CLI capture (US-058)

**Owner:** Engineer (self-serve — npm install).
**Foundational:** also acts as the local capture endpoint for §00.5.5 (VS Code extension). Install this first.

### Steps

1. **Configure access to the team's private npm feed** (if not already done — usually one-time setup per engineer):

   ```bash
   # In ~/.npmrc (gitignored):
   @telenor:registry=https://registry.telenor.internal/npm/
   //registry.telenor.internal/npm/:_authToken=${TELENOR_NPM_TOKEN}
   ```

2. **Install the CLI globally:**

   ```bash
   npm install -g @telenor/agentic-cli
   agentic --version       # should print 1.x.x
   ```

3. **Initialize the local daemon** (it acts as the capture endpoint for VS Code extension + handles outbound submission):

   ```bash
   agentic init            # creates ~/.agentic/config.yaml
   agentic daemon start    # starts the local daemon (foreground for first run)
   ```

   In a separate terminal:

   ```bash
   agentic daemon status   # should report "running on port 7474"
   ```

4. **Test the three input modes:**

   ```bash
   # Mode 1: inline
   agentic capture "The CSV export needs RFC 4180 escaping"

   # Mode 2: from file
   echo "Requirement: rate-limit the API" > /tmp/req.txt
   agentic capture --file /tmp/req.txt

   # Mode 3: from stdin
   git log --oneline -5 | agentic capture --stdin --note "Recent commits suggesting refactor scope"
   ```

   Each should print `Capture submitted: cap-<id>` and produce a NormalizedIntake in `~/.agentic/capture.log`.

5. **Daemonize for boot:** add to `~/Library/LaunchAgents/com.telenor.agentic-daemon.plist` so the daemon starts automatically (template at `agentic init --launch-agent`).

6. **Close US-058** with the three test capture IDs as evidence.

### Acceptance check

- [ ] `agentic --version` returns 1.x
- [ ] Daemon running on port 7474 (or configured alternative)
- [ ] All three input modes produce NormalizedIntake records
- [ ] `source_ref` includes cwd and timestamp
- [ ] Author resolved from `git config user.email` (verify by capturing once with `--as different@email.com` and confirming the override appears in the record)

---

## §00.5.7 — End-to-end smoke test (US-059)

**Owner:** Squad lead (or whoever owns the demo).
**Definition of done for E-00** — when this passes, the Capture Layer is verifiably operational and the epic closes.

### The test

`scripts/smoke-capture.ts` runs through all six channels. For channels the local engineer hasn't provisioned, it skips with a clear `[SKIP — not provisioned]` line rather than failing. This means a solo developer can run the smoke test and prove the *channels they have* work, without requiring full org admin coordination.

### Steps

1. **Run the smoke test:**

   ```bash
   npx tsx scripts/smoke-capture.ts
   ```

2. **Expected output (when all six are provisioned):**

   ```
   §00.5 Capture Layer smoke test — 2026-06-19T14:30:00Z

   [1/6] teams       : sending test transcript ... PASS (87s) — ref AAMkA...
   [2/6] slack       : sending test mention ......... PASS (12s) — ref 1718...
   [3/6] confluence  : creating test page ........... PASS (4m21s) — ref CONF-...
   [4/6] jira        : creating test ticket ......... PASS (18s) — ref PILOT-321
   [5/6] vscode      : invoking command palette ..... PASS (3s) — ref scratch.md:1-3
   [6/6] cli         : capture --stdin ............... PASS (1s) — ref /tmp+1718...

   Result: 6/6 channels operational. Capture Layer healthy.
   Artifact: artifacts/capture-smoke-20260619.md
   ```

3. **For each PASS, the test confirms:**
   - NormalizedIntake produced
   - Schema validates against `docs/normalized-intake.schema.json`
   - Plan-mode session opens in Claude Code (the agent surfaces CP1 prompt within 60 seconds of receiving the intake)
   - Provenance hash of the captured text recorded

4. **If any channel fails**, the report includes the failure mode and the test-skip flag to add if the channel is intentionally not provisioned for this team.

5. **Close US-059** with the smoke test artifact as evidence. E-00 epic closes.

### Acceptance check

- [ ] Smoke test runs without invocation errors
- [ ] At least the self-serve pair (vscode + cli) PASS — minimum bar for a single engineer
- [ ] Channels not provisioned show `[SKIP]` not `[FAIL]`
- [ ] Per-channel PASS produces a NormalizedIntake reaching Claude Code in plan mode
- [ ] Artifact committed to `artifacts/capture-smoke-YYYYMMDD.md` for traceability

---

## Reusability across Telenor teams

This Capture Layer is the **first piece of the Agentic SDLC Pilot reusable across all Telenor teams.** Each team configures its own subset of channels via `config/capture-sources.yaml`. A team using only Jira + Slack skips the Teams/Confluence/VS Code/CLI setup. A team that lives in Confluence + VS Code skips Slack/Teams/Jira. The architecture's "5 tools, 1 orchestrated workflow" promise is preserved — what changes per team is *which intake channels feed the workflow*, not the workflow itself.

When the second team onboards (post-pilot Phase 2), the runbook is: clone this pilot's `config/capture-sources.yaml`, edit for the new team's subset, run the `agentic init --team <name>` wizard, point the daemon at the team's GitHub repo. Closed-form per-team setup, no re-architecture.

---

## When this chapter is complete

- All six channels you've provisioned PASS in the §00.5.7 smoke test
- US-052 through US-059 are closed in GitHub with evidence
- E-00 epic closes
- The team can capture requirements from any of the channels they use without manual re-entry
- §01 (Mac Terminal Preparation) can begin

When you close E-00, paste this to Claude Code:

```
E-00 Capture Layer complete: <N>/6 channels operational per
artifacts/capture-smoke-YYYYMMDD.md. Proceeding to §01 Terminal prep
(E-01 stories).
```

---

_Cross-references: ARCH-AGENTIC-SDLC-001 Rev 1.6 §02.0 (Capture Layer architecture); IMPL-AGENTIC-SDLC-001 Rev 1.5 §03.3 (Keychain storage pattern, reused for source credentials); docs/slack.md (Slack two-surface design)._
