# Slack intake bot (E-09)

Status: **scaffold / dormant**. The bot's business logic is built and tested,
but it does **not** connect to Slack yet — that needs a registered Slack app
and credentials, tracked as **US-038**.

## What exists today

- **`src/slack/bot.ts`** — the §12.2 intake contract: `buildIntakeBundle()`
  turns an `app_mention` event into `{ text, attachments: [{kind,url,hash}],
  trust: 'untrusted' }` (attachments hashed by `url_private`), and
  `bundleToUntrusted()` frames it with the US-023 `<untrusted_input>` tagging.
- **`src/slack/blockkit.ts`** — pure Block Kit builders for the three
  checkpoints (§12.3): `buildPlanApprovalMessage` (Checkpoint 1),
  `buildPrReviewDm` (Checkpoint 2), `buildDeployApprovalMessage` (Checkpoint 3).
  Interaction `action_id`s: `plan_approve|plan_edit|plan_reject`,
  `pr_view|pr_approve|pr_request_changes`, `deploy_approve|deploy_cancel`.
- **`src/slack/intake.ts`** — the richer validation/normalisation layer
  (`NormalizedIntake`: rejects oversized/unsupported files, de-linkifies, etc.)
  used to flesh out US-040.
- **`scripts/slack-bot.ts`** — the Bolt skeleton. `App.start()` is guarded by
  `SLACK_ENABLED` (default `false`), so the file compiles, lints, and is covered
  by tests **without ever connecting**. `triggerRun(bundle)` is a stub that logs.

## What is NOT here (by design)

- No live Slack calls, no Socket Mode connection, no token capture.
- Registering the Slack app and providing `SLACK_BOT_TOKEN` / `SLACK_APP_TOKEN`
  is **US-038**, not US-039.

## Running

```bash
npx tsx scripts/slack-bot.ts                 # prints "dormant" and exits
SLACK_ENABLED=true npx tsx scripts/slack-bot.ts   # only meaningful after US-038
```
