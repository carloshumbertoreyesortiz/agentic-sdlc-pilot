# Agentic SDLC Pilot — Way of Work

> **Companion to:** ARCH-AGENTIC-SDLC-001 Rev 1.7, IMPL-AGENTIC-SDLC-001 Rev 1.6
> **Purpose:** map the Telenor SFB DevOps way-of-work onto the agentic pilot's mechanics — three intake flows, six roles, sprint cadence, status taxonomy, checkpoint routing, external-system sync pattern.
> **Sources:** Sprint_Planning Confluence page, Workshop #1 deck (2026), Ingrid Marie Urdshals emails (2026-06-30, two replies), TelenorNorgeInternal/s06065-sfb-telenor-sfdc#1121 ("Sync between SFB and GitHub"), docs/telenor-gap-analysis.md (PR #106 merged 2026-07-02).
> **Status:** Rev 1.0 — first landing. Amendments carry a changelog at the end.

This document is the operating contract for how the agentic pilot participates in the Telenor SFB team's existing DevOps way-of-work. The pilot does not replace their process; it adapts to it. Where the pilot adds value beyond current practice, that value is named explicitly (agent-authored plans, provenance-gated PRs, capture-layer intake, cross-flow success metrics). Where the SFB team is already implementing something the pilot would have built, the pilot consumes their work as an upstream dependency rather than duplicating it (Flow B → issue #1121).

## §1 Three intake flows

The SFB team's requirement and defect intake flows through three distinct paths, confirmed by the Release Manager (Ingrid Marie Urdshals) on 2026-06-30. Each has a different source system, different reporter identity, and different automation state. The pilot's capture layer (E-00) and integration stories (E-11) map to these three flows explicitly.

**Flow A — Larger initiatives via meetings and dialogue.** Requirements for projects and larger initiatives are gathered through meetings and ongoing stakeholder conversations. There is no single source system; the requirements form in unstructured discussion. The pilot's capture layer (E-00, stories US-052 through US-059) ingests these conversations through six configured channels: Teams meeting transcripts, Slack messages, Confluence pages, Jira tickets, VS Code Command Palette selections, and Terminal CLI. Each channel produces a `NormalizedIntake` record with `source`, `source_ref`, `text`, and `trust: "untrusted"` (never trusted — the capture layer wraps everything for downstream US-023 untrusted-input framing). Verified state as of 2026-06-30: 0 of 6 channels are operational; US-052 (the schema itself) through US-059 (the end-to-end smoke test) are all open. Slack is the only channel with substance — US-038 (app registration) is closed and `src/slack/bot.ts` logic is built and tested — but it is scaffold/dormant, not connected to Slack yet, per `docs/slack.md`.

**Flow B — End-user requirements via Salesforce TCR Cases.** Business Analysts (named individuals per Workshop #1 slide 6: Nina Jakobsen, Erik Lauvli, Tommy Paulsen, Espen Sanden, Erik Moberg, Ingrid Marie Urdshals, Piero Notaro, Johannes Dalholt) submit Telenor Change Request (TCR) cases in SFB Salesforce. When a TCR is approved and moves to Process Stage = Sprint Planning, a GitHub issue is created for the change. **This automation is being implemented by the SFB team under Apoorv Shukla's ownership as TelenorNorgeInternal/s06065-sfb-telenor-sfdc#1121, opened by Ingrid on 2026-01-07 and marked "In progress" on the SfB Mobile CPQ Tasks board since 2026-04-09.** The agentic pilot does not duplicate this work; the pilot's US-072 is rescoped from implementation to *conformance*, ensuring the pilot's issue schema (field names, values, taxonomies) is compatible with what #1121 emits so pilot-owned repos can receive SF-sourced issues without translation shims.

**Flow C — Defects via Matrix (ServiceNow).** Incidents and defects are logged in Telenor's local ServiceNow instance at matrix.telenor.no. Access is controlled by the "Authorized Incident Reporter" (AIR) role, requested per Matrix knowledge base article KB0010037. Currently, Accenture developers responsible for troubleshooting incidents do not have Matrix access; Ingrid personally creates a GitHub issue for each new Matrix incident, tracks progress in GitHub, and manually updates the incident in Matrix based on the latest information. This is bidirectional manual toil dependent on a single named person — Ingrid explicitly named it as her highest-priority automation target because it is "the most vulnerable and person-dependent task." The pilot's US-075 builds a bidirectional Matrix ↔ GitHub sync using ServiceNow's Business Rules and Table API, following the External System Bidirectional Sync pattern (§7 below).

The three-flow model corrects an earlier two-flow assumption in the architecture. The pilot's value proposition differs meaningfully by flow, which is why US-078 introduces per-flow success metrics rather than aggregating across all intake.

**E-00 ↔ three-flow channel mapping (US-069).** The E-00 capture channels map onto the three flows as below; see [capture-layer.md](capture-layer.md) §00.5.0 for the full channel table.

| Flow | Capture channels | Ownership |
|---|---|---|
| A — meetings/dialogue | Teams, Slack, Confluence, **Outlook** (email, ~50% of intake), VS Code, Terminal CLI | Pilot (E-00) |
| B — SFB TCR Cases | Salesforce | Upstream #1121 — pilot *receives* |
| C — Matrix defects | Matrix / ServiceNow | Upstream #1595 — pilot *receives* |

**Jira** is **deprecated for the SFB context** (SFB uses Salesforce + Matrix, not Jira); E-00 schema support is retained for other teams. The canonical `NormalizedIntake` code type (US-052, open) must include the `outlook`, `salesforce`, and `matrix` source values when implemented (US-069 updates the documented source union; the code lands with US-052).

**Planner routing per flow (US-076).** The planner shapes its output by flow, keyed off `NormalizedIntake.source` (implemented in `src/planner.ts` `flowFromSource` + `plannerInstructions`, wired into `scripts/agent-planner.ts`): **Flow A** → full requirement decomposition (epic + stories, Type + acceptance criteria, Business-Area classification and BA routing per §12–§13); **Flow B** → a verification pass on the pre-classified #1121 fields, skipping planning entirely when all required fields are present; **Flow C** → bug triage (reproduction steps, root-cause hypothesis, single recommended next action, linked to the Matrix incident). The three instruction blocks are mutually exclusive (no cross-flow contamination).

## §2 Sprint cadence

Telenor SFB operates on a **2-week sprint** cadence with three continuous phases surrounding a discrete Plan/Close boundary.

**Plan.** At the start of each sprint, the work to be done is defined and agreed. Business Analysts present TCR cases in the Business Backlog meeting where the team of Business Analysts plans a couple of sprints ahead. Approved requests move to Sprint Planning and receive time estimates and priorities. The Change Lead confirms sprint scope.

**Create, Review, Release.** These three phases run continuously during the sprint, not sequentially. Administrators and Developers self-assign issues from the current sprint view, sorted by priority. Development happens in sandbox environments; when a change is testable, it is promoted to UAT via the CI/CD pipeline (DevOps Center + GitHub Actions for Salesforce and Vlocity). User Acceptance Testing is performed by the Business Analyst who owns the requirement; all acceptance criteria must be tested and documented in the GitHub issue before the change moves to Ready for Deployment. The Change Lead performs a readiness check before deployment. Deployment is continuous — successful deployments update the GitHub issue status to Deployed and notify the requestor to verify in production.

**Close.** At the end of the sprint, all changes defined in sprint planning should be deployed and verified in production. A retrospective on the process and way-of-work is conducted. Adjustments are agreed for the next sprint.

The pilot maps this cadence onto its 3-checkpoint agentic flow: CP1 aligns with Plan (plan approval), CP2 aligns with Create/Review (PR review + gates), CP3 aligns with the readiness check and deployment gate. Continuous flow within the sprint is preserved — the pilot does not force artificial batching.

## §3 Six confirmed roles

Workshop #1 identified six Sprint Team roles. The "Other Roles Needed?" slot on Slide 5 was an open discussion prompt that concluded during the workshop with no additional roles identified or agreed. The Release Manager responsibility described in Ingrid's 2026-06-30 email maps to the Change Lead role (not a distinct seventh role); Ingrid explicitly stated *"I hold the Change Lead role for requests created in SFB."* Change Lead identity is per-initiative — Ingrid is Change Lead for SFB-originated requests; other initiatives have different Change Leads. Technical Lead is a named role held by Apoorv Shukla, who runs weekly technical meetings and coordinates across developers.

**Business Analyst.** Works closely with users and stakeholders to define desired features. Responsible for documenting business needs and requirements, getting user acceptance testing done within time, and communicating changes to the right user groups. Ensures training when needed. Focus: maximizing the value of deliveries. Named holders per Workshop #1 slide 6: eight BAs each with one or more Business Area responsibilities.

**Administrator.** Works with Business Analysts to define optimal processes. Customizes the Salesforce platform with no-code configurations. Documents work and keeps the Business Analyst in the loop. Helps with training materials. Focus: building the products.

**Developer.** Creates and customizes applications and functionality on the Salesforce platform through code. Writes and tests code, builds custom solutions, handles the more complex change requests. Focus: building the products. In the agentic pilot, this role has an agent component (Claude Code) supplementing human developers.

**Change Lead.** Keeps everyone accountable to their commitments. Manages the team's delivery process. Steers the team from bad habits and inefficient processes. Facilitates the Change Management process for SFB. Removes obstacles hindering team progress. Change Lead identity is per-initiative: Ingrid Marie Urdshals for SFB-originated requests; other Change Leads for other initiatives. In the agentic pilot's checkpoint model, Change Lead holds authority over CP1 (plan approval) and CP3 closure.

**Technical Lead.** Helps the team remove blockers. Keeps the team on track to complete work defined in the sprint backlog. Leads the technical meetings. Responsible for deployment. Responsible for planning and executing sandbox refreshes. Controls and documents that everything is done in all environments before issues are closed. Held by Apoorv Shukla. In the agentic pilot's checkpoint model, Technical Lead holds authority over CP2 (PR review) and shares CP3 (deployment gate) with Change Lead.

**Initiative Lead.** Prioritizes and coordinates across an initiative that spans multiple change requests. Present in the Confluence Sprint_Planning documentation as the person responsible for GitHub-only initiatives (Flow A's larger initiatives that don't have a corresponding SFB TCR case). In the agentic pilot's checkpoint model, Initiative Lead holds authority over CP1 for initiative-level work.

The pilot's role configuration lives in `docs/team-routing.yaml` (established by US-070). Each initiative declares its Change Lead and Initiative Lead as metadata; the pilot's CP1/CP3 approval routing consults this file to determine who must approve. This means CP3 approvals never route to a single hard-coded person — they route to whoever holds the Change Lead role for the initiative that owns the work.

## §4 Checkpoint routing

The agentic pilot has three human-in-the-loop checkpoints. Each maps to Telenor roles for approval authority. The specific person for each role is resolved per initiative from [`docs/team-routing.yaml`](team-routing.yaml) (US-070): CP1/CP3 route to the initiative's Change Lead, CP2/CP3 to its Technical Lead.

**CP1 — Plan approval.** After the planner agent produces a plan from a `NormalizedIntake` record, a human reviews and approves the plan before any code work begins. This is the earliest and cheapest place to catch scope errors, misunderstood requirements, or approach mistakes. Approval authority: Change Lead (for SFB-originated work) or Initiative Lead (for initiative-scoped work). The plan itself is captured in the issue body and versioned; provenance records the CP1 approver identity, timestamp, and approved plan hash.

**CP2 — PR review.** After the coder agent produces a pull request, the PR flows through GitHub's normal review process plus the two required gates (`check`, `agent-provenance`) and the shell-lint gate (for shell scripts, from US-060). Human review authority: Technical Lead (Apoorv for the pilot's own PRs; per-initiative Technical Lead otherwise). The provenance file records the PR link, gate outcomes, review identity, and merge commit.

**CP3 — Deployment gate.** Before a change is deployed to production, a readiness check confirms all acceptance criteria are tested and documented, stakeholders are informed, and training is completed if needed. Approval authority: Technical Lead performs the readiness check; Change Lead performs the final closure. Both approvals are required. The provenance file records both identities and the deployment status. Deployment success updates the GitHub issue status to Deployed and triggers a notification to the requestor for production verification. The requestor performs the verification and, when confirmed, the Change Lead closes the issue with status = Done and updates the SFB Case to Closed.

The scope-freeze rule (§8) applies at CP2 → CP3 transition: only functionality agreed upon during the Create and Review phase (from CP1 through CP2 merge) is relevant for CP3 confirmation. New requirements are new tickets.

## §5 Status taxonomy

The pilot adopts the fuller status taxonomy from issue #1121, which is richer than the seven states documented in the Sprint_Planning Confluence page. This is the actual working taxonomy the SFB team uses in practice.

**Draft.** Pre-backlog state. The requirement is being gathered and documented; it is not yet ready for prioritization.

**Backlog.** The requirement is documented and awaiting prioritization. Included in the Business Backlog meeting for review.

**Ready for Development.** The requirement is prioritized, sized, and ready to be picked up in a sprint. Sprint field is populated.

**Analysis.** In-sprint state. The developer or administrator is analyzing the approach before writing code or configuration. Introduced by #1121's expanded taxonomy.

**Development.** In-sprint state. Active development work in the sandbox environment. Introduced by #1121's expanded taxonomy.

**User Acceptance Test.** In-sprint state. Change is testable and has been promoted to UAT via the CI/CD pipeline; Business Analyst is performing UAT. Maps to SFB status "Leveransesjekk" (Norwegian: "delivery check"). Introduced by #1121's expanded taxonomy.

**Ready for Deployment.** UAT is complete, all acceptance criteria are tested and documented in the GitHub issue, readiness check has passed. Awaiting deployment.

**Pending Requestor.** Blocked awaiting a response, decision, or artifact from the requestor. Introduced by #1121's expanded taxonomy.

**Deployed.** Change has been deployed to production but not yet verified by the requestor.

**Done.** Change has been verified in production. GitHub issue closed with status = Done; SFB Case closed with status = Closed.

The `Blocked` label is orthogonal to the status field. It flags an external dependency; the underlying status continues to reflect where in the lifecycle the work is stuck.

The pilot's board currently uses a 4-value Status field (Todo / In Progress / Blocked / Done). US-063 expands this to the ten states above; the migration touches Project admin permissions and is Carlos-mediated with rollback.

## §6 Issue Type and Sub Epic taxonomy

The pilot adopts issue #1121's Type and Sub Epic model as first-class categorization, replacing the current `epic`/`story` label approximation. Type is a native GitHub Issue Type; Sub Epic is a Project custom field.

**Type = Feature.** A request for a new feature. Body must contain: background and pains to solve, business value, user story, acceptance criteria. Mapped from SFB Type = New Feature.

**Type = Story.** A complex change with meaningful scope. Body must contain user story and acceptance criteria. Mapped from SFB Type = Improvement + Complexity = Medium or Hard.

**Type = Task.** A minor change or clean-up. Body requires a description only. Mapped from SFB Type = Clean-Up, or Type = Improvement + Complexity = Easy.

**Type = Bug.** A defect in existing functionality (non-Matrix).

**Type = Incident.** A Matrix / ServiceNow-sourced incident (Flow C). Carries Matrix-specific fields (Caller, Alternate Contact), Sub Epic = Matrix Defect, and an External References record pointing at the `INC…` source; auto-populated by the #1595 sync (US-075).

**Sub Epic values.** Clean-Up, New Feature, Minor Improvements and Bug Fixes, Major Improvements and Bug Fixes, Matrix Defect. The first four match #1121's mapping table; Matrix Defect is a pilot-side addition for US-075's outputs.

Complexity → Size mapping follows #1121: Easy or Fair → S, Medium → M, Hard → L. The pilot does not use XL — the SFB team's scale stops at L, and the pilot conforms.

The **four** issue templates in `.github/ISSUE_TEMPLATE/` (established by US-068 — `feature.md`, `story-or-task.md`, `bug.md`, `incident.md`, plus `config.yml` disabling blank issues) surface Type + Sub Epic as required Project fields and the Type-specific body sections: **Feature** (background/pains + business value + user story + AC), **Story/Task** (description; AC required for Story), **Bug** (expected vs actual + repro steps), and **Incident** (Matrix-sourced — Caller required, Alternate Contact, and the External References link to the `INC…` record).

## §7 External System Bidirectional Sync pattern

Two integration stories — #1121 (SF TCR Case ↔ GitHub) owned by Apoorv's team, and US-075 (Matrix ↔ GitHub) owned by the pilot — share a common architectural pattern. Naming it explicitly here so both implementations converge on the same shape, so the parked Alpha integration program can reuse it, and so future external-system syncs (e.g. Jira for teams that use it) inherit the pattern.

**Pattern shape.**

*Trigger direction (external → GitHub).* The external system fires an event when a case, incident, or ticket meeting defined criteria is created or transitions state. Salesforce uses a Business Rule + Platform Event; ServiceNow uses a Business Rule + outbound REST call. The event carries the source record identifier and enough context to construct the GitHub issue.

*Sink direction (external → GitHub).* A GitHub Actions webhook receiver accepts the event, validates the payload, and creates or updates the GitHub issue using the field mapping table specific to that external system. The pilot's issue schema (fields, Types, Sub Epics, Status values) is designed to accommodate the fields both external systems emit.

*Reverse direction (GitHub → external).* When the GitHub issue transitions status, receives a comment, or has fields changed (Priority, Size, Estimate, Time Used, Expected Completion Date), a GitHub Actions workflow on issue events uses the external system's REST API to update the source record and add a mirroring comment. For Salesforce, this is REST callout via Luis's proxy (SFB team infrastructure); for ServiceNow, this is Table API via ServiceNow's authenticated REST endpoint.

*External References mechanism.* Every GitHub issue created from an external system carries an External References record: `Reference Id` (the source-system identifier — SFB Case Number or Matrix Incident Number), `Reference Type` (SFB / Matrix / Jira / etc.), `Reference URL` (a deep link back to the source record). This mechanism was established by #1121 for SF TCR Cases and is adopted verbatim by US-075 for Matrix incidents. It is the canonical way to answer "what is the source of this issue?"

*Field mapping table.* Each external system has a defined field mapping from source fields to GitHub fields. #1121's mapping table (Subject → Title, Description → Background, Priority → Priority, Complexity → Size, etc.) is authoritative for SF TCR Cases. US-075 defines the equivalent mapping for Matrix incidents (Short Description → Title, Description → Background, Priority → Priority, Assigned To → Reporter, etc.).

*Status mapping table.* Each external system has a defined status mapping. #1121's status mapping table (Ready for Development → Process Stage = In Active Sprint + Status = In Progress, etc.) is authoritative for SF. US-075 defines the equivalent for Matrix (Analysis → New / Assigned, Ready for Deployment → Awaiting Deployment, Deployed → Resolved, Done → Closed, etc.).

The GitHub status ↔ SFB mapping (US-063). The GitHub ten-state taxonomy (§5) maps to the SFB Case **Process Stage** and **Sprint Status** as below. **The authoritative source is #1121; SFB-side cells marked _(confirm)_ are provisional and are reconciled with Apoorv during US-072 conformance** — they are not asserted here.

| GitHub Status | SFB Case Process Stage | SFB Sprint Status |
|---|---|---|
| Draft | pre-case / gathering | — |
| Backlog | Business Backlog _(confirm)_ | To Do _(confirm)_ |
| Ready for Development | In Active Sprint | In Progress |
| Analysis | In Active Sprint _(confirm)_ | In Progress _(confirm)_ |
| Development | In Active Sprint _(confirm)_ | In Progress _(confirm)_ |
| User Acceptance Test ("Leveransesjekk") | In Active Sprint _(confirm)_ | UAT _(confirm)_ |
| Ready for Deployment | Ready for Deployment _(confirm)_ | Done (sprint) _(confirm)_ |
| Pending Requestor | on hold — requestor _(confirm)_ | On Hold _(confirm)_ |
| Deployed | Deployed _(confirm)_ | — |
| Done | Closed | Done |

_#1121's status **transition rules** (which state may move to which, and the gates between) are authoritative and are consumed by US-072; this table records the state correspondence only._

*Comment forwarding.* When a comment is added to the GitHub issue, it is forwarded as a work note or comment on the source record. The forwarding preserves the GitHub commenter identity in the forwarded content.

*Duplicate prevention.* Before creating a GitHub issue from an external event, the sink checks whether the source record already has a GitHub reference in its External References. If yes, no duplicate is created; the existing issue is updated instead.

**Risks the pattern acknowledges.**

*Schema drift.* If #1121 changes its field mapping or Type taxonomy after US-072 conformance work has landed, the pilot repos receiving SF-sourced issues break. Mitigation: US-072 explicitly tests conformance against a snapshot of #1121's mapping table; drift triggers a rebase.

*Circular update loops.* External → GitHub → external round-trips can loop if not carefully idempotent. The pattern requires idempotency keys on both directions: source-record modifications tagged with the sync agent's identity are ignored by the reverse-direction handler.

*Partial failure.* If a GitHub → external update fails (network error, source-system downtime), the GitHub issue and source record drift out of sync. Mitigation: US-075 and #1121 both maintain a retry queue with exponential backoff and alert on sustained failure.

## §8 Scope-freeze rule

From Workshop #1 slide 11: *"Only functionality agreed upon during Create and Review is relevant for confirmation. New functionality or adjustments on the functionality deployed must be reported as a new change request."*

The pilot adopts this as a binding constraint on the agentic flow. Once CP1 plan approval is granted and CP2 PR merge occurs, the scope for CP3 confirmation is frozen to what was in the CP1-approved plan. Any new requirement that surfaces during Create/Review, UAT, or post-deployment is a new ticket, not a scope extension to the current one.

The provenance schema (from US-071) records the CP1-approved plan hash. The CP3 gate compares the delivered work against the plan hash; scope additions that were not in the approved plan cause the gate to fail with a directive to open a new ticket. This makes scope discipline auditable, not just aspirational.

The pilot's existing CLAUDE.md hard rule *"Stay in scope — do only what the approved plan covers; surface anything beyond it instead of silently expanding"* is a per-task discipline that supports but does not replace the Telenor scope-freeze rule. US-071 adds the scope-freeze rule to CLAUDE.md explicitly and wires it into provenance.

## §9 Cross-dashboard navigation

Two dashboards exist and complement each other. The pilot's GitHub Pages dashboard (US-051, US-050, US-048) tracks delivery — stories closed, PRs merged, epic progress, sprint velocity. The Telenor Salesforce dashboard at SF Dashboard ID `01ZdV000000uD2bUAE` tracks TCR intake — cases submitted, approved, in the SFB backlog, rejected. These are different abstractions and both are useful.

The pilot's dashboard (US-073) now shows a top-level cross-dashboard banner (`index.html`) with a one-line description of each dashboard and a link to the Salesforce **SFB Request Backlog** dashboard (`https://telenor.lightning.force.com/lightning/r/Dashboard/01ZdV000000uD2bUAE/view?queryScope=userFolders`, confirmed by Ingrid on 2026-07-08), which opens via Telenor SSO. The reverse link — Salesforce dashboard linking to the pilot's Pages URL — is out of scope for the pilot; it requires Salesforce admin work that Ingrid can arrange independently if she chooses.

The two dashboards give the council a complete picture: SF dashboard answers "are requirements being captured and approved?" and the pilot dashboard answers "is approved work being delivered?"

## §10 Phase 1 success metrics

Per US-078, Phase 1 success is measured per-flow rather than aggregated. The three flows have different baselines and different improvement curves; single aggregated metrics would obscure which value proposition is actually landing.

**Flow A metrics.** Number of channels operational (baseline 0, target 4+ of 6); intakes per channel per week; CP1 acceptance rate on planner-generated plans; time from intake to CP1 approval.

**Flow B metrics.** Number of SF TCR Cases synced to GitHub via #1121 per sprint (dependent on Apoorv's implementation landing); pilot schema conformance rate (percentage of received issues that require no translation shim); manual copy-paste time saved per week (baseline: Ingrid's current effort).

**Flow C metrics.** Number of Matrix incidents synced to GitHub via US-075 per week; manual sync effort saved per week (baseline: Ingrid's current effort — this is the key-person-risk elimination measurement); GitHub → Matrix reverse-sync latency; sync failure rate.

**Cross-flow metric — key-person-risk.** Count of business-critical processes still dependent on a single person's manual work. Baseline at Phase 1 kickoff: 1 (Ingrid's Matrix ↔ GitHub sync). Target at Phase 1 exit: 0.

The dashboard generator (scripts/dashboard.ts) is extended by US-078 to compute and render per-flow metrics. Each metric has a source data query, a definition, and a display convention documented in the dashboard code itself.

## §11 Coordination cadence

The pilot participates in the SFB team's existing rhythms rather than introducing new ones.

**Weekly technical meeting.** Apoorv runs a weekly technical meeting for developers. The pilot's Rev 1.7 architecture is reviewed in this meeting when ready; ongoing E-11 work is reported here.

**Sprint planning and retrospective.** The pilot's E-11 stories are added to the SFB team's 2-week sprint cadence. Sprint planning agrees which E-11 stories are picked up; retrospective evaluates whether the pilot is delivering value against the per-flow metrics.

**Ad-hoc coordination with Apoorv.** Direct email or Slack thread for coordination on #1121 schema decisions, US-072 conformance testing, and US-075 design review.

**Council review.** The Phase 0/1 governance council (per docs/PHASE-0-1-REPORT.md) reviews Rev 1.7 for approval to proceed to Phase 1 execution. Council asks (b), (c), (d) from PR #87 remain outstanding on human stakeholders.

**Adoption risks.** The coordination and dependency risks this cadence exists to manage are tracked in [risks.md](risks.md): **R-TELENOR-CONCURRENT-MIGRATION** (four concurrent SFB migrations), **R-SERVICENOW-DEPENDENCY** (AIR service account gating US-075), and **R-SFB-COORDINATION** (schema drift vs upstream #1121/#1595). Each carries an explicit exit trigger (US-077).

## §12 Named stakeholders

Recording explicitly for traceability. Named individuals are cited with their role, primary responsibility for the pilot, and the source that documents them. Individuals not listed here are still part of the SFB team but do not have a pilot-specific coordination role at this time.

| Name | Role | Pilot responsibility | Source |
|---|---|---|---|
| Ingrid Marie Urdshals | Change Lead (SFB); Business Analyst (Customer Service + Fixed Order and Delivery + Fault Management + Invoice and Credit + Complaints) | CP1 approval and CP3 closure for SFB-originated work; owner of #1121; owner of the Matrix ↔ GitHub sync problem US-075 solves | Workshop #1 slide 6; email 2026-06-30 (both replies); #1121 |
| Apoorv Shukla | Technical Lead | CP2 authority; owner of #1121 implementation on the SFB side; runs weekly technical meeting; original architect of the hub-and-spoke design | Workshop #1 (referenced); Ingrid email 2026-06-30; #1121 assignee |
| Carlos Reyes | Pilot lead, Initiative Lead (agentic pilot) | Overall pilot ownership, CP1 for pilot-scoped work, org-transfer runbook execution, credential and password management | Repository owner; docs/transfer-runbook.md |
| Luis Carlos Martins | Integration infrastructure (proxy) | Configures the outbound REST proxy used by US-072 conformance testing and any future SF integrations | Meeting transcript (2026-06-12) |
| Martin Aarseth Karlsen | Product / management sponsor | Introduced the pilot to the SFB team; part of the initial requirements conversation with Per and Apoorv | Meeting transcripts |
| Per Ivar Thune | Product / management sponsor | Co-sponsor with Martin; source of the "living dashboard within Git" requirement | Meeting transcripts |
| Nina Jakobsen | Business Analyst (DPSS Sales) | Flow A intake for DPSS Sales requirements | Workshop #1 slide 6 |
| Erik Lauvli | Business Analyst (Mobile Sales Mass Market, Dealers) | Flow A intake for Mobile Sales Mass Market and Dealer requirements | Workshop #1 slide 6 |
| Tommy Paulsen | Business Analyst (Customer Success) | Flow A intake for Customer Success requirements | Workshop #1 slide 6 |
| Espen Sanden | Business Analyst + Administrator (Customer Success) | Flow A + Admin work for Customer Success | Workshop #1 slide 6 |
| Erik Moberg | Business Analyst (Customer Service + Fixed Order and Delivery + Fault Management + Invoice and Credit + Complaints) | Flow A intake for the customer-service cluster of business areas | Workshop #1 slide 6 |
| Piero Notaro | Business Analyst (Mobile Sales, Content) | Flow A intake for Mobile Sales and Content requirements | Workshop #1 slide 6 |
| Johannes Dalholt | Business Analyst + Administrator (Mobile Sales Enterprise, DPSS Sales - Admin, Product & Content - Admin) | Flow A + Admin work for Mobile Sales Enterprise, DPSS Sales admin, Product & Content admin | Workshop #1 slide 6 |

## §13 Business areas

The SFB team defines **eleven** business areas (authoritative per Ingrid, PR #136 review 2026-07-08 — this supersedes the ~20-area workshop list). They are the values of the Project **Business Area** field:

Complaints · Content · Customer Service · Customer Success · Dealers · DPSS Sales · Fault Management · Fixed Order and Delivery · Invoice and Credit · Mobile Sales · Product.

**Business Analysts work in the SFB Salesforce case, not GitHub** (Ingrid, #136): a BA completes analysis and tasks on the case *before* the issue reaches GitHub, then hands the issue to the Change Lead, and thereafter follows request status from the SFB case. So the pilot performs **no area → Business-Analyst routing in GitHub** — the Business Areas are a classification field only, and GitHub checkpoint routing is Change Lead / Technical Lead (§4). `docs/team-routing.yaml` (US-070) encodes the initiative → Change Lead / Technical Lead map plus this area list.

## §14 Change log

**Rev 1.0 — 2026-07-02.** First landing. Establishes three-flow intake model, six-role taxonomy with per-initiative Change Lead binding, sprint cadence mapping, expanded status taxonomy from #1121, Type + Sub Epic model from #1121, External System Bidirectional Sync pattern, scope-freeze rule, cross-dashboard navigation, per-flow Phase 1 success metrics, coordination cadence, named stakeholders, business areas. Companion to Architecture Rev 1.7.
