# Transfer runbook — personal → TelenorNorgeInternal

Execute the moment the repo lands in `TelenorNorgeInternal` (transfer performed
by an org owner; history preserved). Resolves risk **R-02**. Steps are
parameterized — set the variables once and paste the blocks.

> Project 408 is **off-limits permanently**. The pilot uses its own org project
> **"Agentic SDLC Pilot"**, which an org admin must create first. Capture its
> number into `PILOT_PROJECT` below — do not use 408.

## 0. Parameters

```bash
OLD_OWNER=carloshumbertoreyesortiz
NEW_OWNER=TelenorNorgeInternal
REPO=agentic-sdlc-pilot
NEW_FULL="$NEW_OWNER/$REPO"
PROJECT_OWNER="$NEW_OWNER"
PILOT_PROJECT=          # <-- fill in once the org "Agentic SDLC Pilot" project exists
```

## 1. Verify the transfer happened

```bash
gh repo view "$NEW_FULL" --json nameWithOwner,owner,visibility
# expect: owner.login = TelenorNorgeInternal, visibility = PRIVATE
```
If this errors, STOP — the transfer has not completed; chase the org owner.

## 2. Re-point the local clone

```bash
cd ~/Code/telenor/agentic-sdlc-pilot
git remote set-url origin "git@github.com:$NEW_FULL.git"   # or https://github.com/$NEW_FULL.git
git remote -v
git fetch origin && git status
```

## 3. Update doc/path references

Find any lingering references to the old owner and rewrite them:

```bash
grep -rl "$OLD_OWNER/$REPO" --include='*.md' --include='*.json' --include='*.yml' . \
  | grep -v node_modules | grep -v package-lock
# rewrite (review the diff before committing):
grep -rl "$OLD_OWNER/$REPO" --include='*.md' --include='*.json' --include='*.yml' . \
  | grep -v node_modules | grep -v package-lock \
  | xargs sed -i '' "s|$OLD_OWNER/$REPO|$NEW_FULL|g"
```
Known reference today: `docs/risks.md` (R-02). Workflows use `${{ github.repository }}`
(dynamic) and need no change. `docs/provenance.schema.json` `$id` is a synthetic
URN, not the repo URL — leave it.

## 4. Close risk R-02

In `docs/risks.md`, set R-02 status to **Resolved** with a note:
`Resolved <date> — transferred to TelenorNorgeInternal (history preserved); repo
now under org governance/SSO/audit. Evidence: gh repo view $NEW_FULL.`

## 5. Land steps 3–4 via the normal gate

```bash
git checkout -b agent/post-transfer-fixups
# (edit docs as above)
PROV_TOOLS="Read,Edit,Bash" npx tsx scripts/write-provenance.ts "Post-transfer: re-point refs + close R-02"
git add -A && git commit -m "docs: post-transfer reference fixups + close R-02"
git push -u origin agent/post-transfer-fixups
gh pr create --base main --fill && gh pr merge --squash --admin --delete-branch
```

## 6. Add all 57 issues to the pilot project (NOT 408)

```bash
test -n "$PILOT_PROJECT" || { echo "Set PILOT_PROJECT first (the org 'Agentic SDLC Pilot' project number)"; exit 1; }
test "$PILOT_PROJECT" != "408" || { echo "REFUSING: 408 is the SFB board, off-limits"; exit 1; }

gh issue list -R "$NEW_FULL" --state all --limit 200 --json url -q '.[].url' > /tmp/urls.txt
ok=0; fail=0
while IFS= read -r u; do
  if gh project item-add "$PILOT_PROJECT" --owner "$PROJECT_OWNER" --url "$u" >/dev/null 2>&1; then
    ok=$((ok+1)); printf '.'
  else fail=$((fail+1)); echo " FAIL: $u"; fi
done < /tmp/urls.txt
echo; echo "added ok=$ok fail=$fail"

# verify (allow a moment for the projects API to settle)
sleep 5
gh project item-list "$PILOT_PROJECT" --owner "$PROJECT_OWNER" --format json -L 200 -q '.items | length'
# expect 57
```

> If an interim **personal** project exists (e.g. `@me` project #1 created during
> Phase 0), delete it after the org project is populated:
> `gh project delete <n> --owner @me` (deleting a project does not delete issues).

## 7. Optional — harden admin bypass (R-01)

Once a second collaborator can review, flip `enforce_admins` to true:

```bash
gh api -X PUT "repos/$NEW_FULL/branches/main/protection/enforce_admins"
```
Revisit at the E-10 governance review (US-047).

## 8. Decommission the interim board (final step)

Only after the org "Agentic SDLC Pilot" project is **populated and verified at
57 items** (step 6), delete the interim personal board so two boards never
coexist:

```bash
# preconditions: org project verified at 57 items
count=$(gh project item-list "$PILOT_PROJECT" --owner "$PROJECT_OWNER" --format json -L 200 -q '.items | length')
test "$count" = "57" || { echo "Org project has $count items, expected 57 — do NOT delete the interim board yet"; exit 1; }

gh project delete 1 --owner @me   # interim "Agentic SDLC Pilot — Phase 0/1"; deleting a project does not delete issues
```
