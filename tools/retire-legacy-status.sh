#!/usr/bin/env bash
#
# retire-legacy-status.sh — US-063 step 3: retire non-canonical Status options.
# Doc:      BACKLOG-AGENTIC-SDLC-001 / US-063 · docs/way-of-work.md §5
# Lineage:  peer to tools/expand-status-field.sh; four-rule shell gate per US-060.
#
# The third one-shot in the Status migration sequence:
#   1. expand-status-field.sh   — ADD the ten SFB states (keep legacy; no orphan).
#   2. (Carlos-mediated remap)   — move items off legacy statuses.
#   3. retire-legacy-status.sh   — THIS: drop everything that is not one of the
#                                  ten canonical states, leaving exactly:
#      Draft, Backlog, Ready for Development, Analysis, Development,
#      User Acceptance Test, Ready for Deployment, Pending Requestor, Deployed, Done
#
# SAFE BY DESIGN: refuses to run (exits non-zero, loudly) if ANY item still
# references a non-canonical Status value — so retirement can never orphan an
# item. DRY-RUN BY DEFAULT; pass --apply to mutate.
#
#   ./tools/retire-legacy-status.sh [--apply] [owner-login] [project-number]
#   defaults: dry-run  carloshumbertoreyesortiz  1
#
# REQUIRES Project-admin permission. bash 3.2 clean (US-060).

set -euo pipefail

APPLY=0
if [ "${1:-}" = "--apply" ]; then APPLY=1; shift; fi
OWNER="${1:-carloshumbertoreyesortiz}"
NUMBER="${2:-1}"

command -v gh >/dev/null 2>&1 || { echo "FAIL: gh CLI not found"; exit 3; }

# The ten canonical SFB states, in order (the desired final option set).
TARGETS="Draft
Backlog
Ready for Development
Analysis
Development
User Acceptance Test
Ready for Deployment
Pending Requestor
Deployed
Done"

# Pipe-free membership test (no SIGPIPE race — see tools/README.md Bug 6).
is_target() {
  case "
$TARGETS
" in
    *"
$1
"*) return 0 ;;
    *) return 1 ;;
  esac
}

# ── resolve the Status field + its current options ───────────────────────────
FIELD_QUERY="query { user(login: \"$OWNER\") { projectV2(number: $NUMBER) { field(name: \"Status\") { ... on ProjectV2SingleSelectField { id options { id name } } } } } }"
FIELD_ID="$(gh api graphql -f query="$FIELD_QUERY" --jq '.data.user.projectV2.field.id // empty')"
if [ -z "$FIELD_ID" ]; then echo "FAIL: no Status single-select field on $OWNER #$NUMBER"; exit 3; fi
EXISTING="$(gh api graphql -f query="$FIELD_QUERY" --jq '.data.user.projectV2.field.options[] | .id + "\t" + .name')"

echo "-> Status field: $FIELD_ID"
echo "-> Non-canonical options present (will be retired):"
noncanon=0
while IFS="$(printf '\t')" read -r _id nm; do
  [ -z "$nm" ] && continue
  if ! is_target "$nm"; then echo "     - $nm"; noncanon=$((noncanon + 1)); fi
done <<< "$EXISTING"
[ "$noncanon" -eq 0 ] && echo "     (none — field already canonical)"

# ── SAFETY: refuse if any item still references a non-canonical status ────────
ITEMS_JSON="$(gh project item-list "$NUMBER" --owner "$OWNER" --format json --limit 500 2>/dev/null)" || true
if ! printf '%s' "$ITEMS_JSON" | jq -e '.items' >/dev/null 2>&1; then
  echo "FAIL: could not read item statuses to verify safety — refusing to retire."
  exit 3
fi

bad=0
STATUSES="$(printf '%s' "$ITEMS_JSON" | jq -r '.items[] | select(.status != null) | .status + "\t#" + ((.content.number // 0)|tostring) + "\t" + (.content.title // "")')"
while IFS="$(printf '\t')" read -r st num title; do
  [ -z "$st" ] && continue
  if ! is_target "$st"; then
    echo "  BLOCKED: $num still uses non-canonical status \"$st\"  ($title)"
    bad=$((bad + 1))
  fi
done <<< "$STATUSES"
if [ "$bad" -gt 0 ]; then
  echo "FAIL: $bad item(s) still reference a non-canonical status."
  echo "      Migrate them onto a canonical state first (see the US-063 remap),"
  echo "      then re-run. Nothing was changed."
  exit 4
fi
echo "-> Safety check OK: no item references a non-canonical status."

# ── build the exact ten canonical options (reuse ids where present) ──────────
existing_id_for() {
  local want="$1" id nm
  while IFS="$(printf '\t')" read -r id nm; do
    if [ "$nm" = "$want" ]; then printf '%s' "$id"; return 0; fi
  done <<< "$EXISTING"
  return 0
}
build_options() {
  local out="" first=1 s id
  while IFS= read -r s; do
    [ -z "$s" ] && continue
    id="$(existing_id_for "$s")"
    if [ "$first" -eq 1 ]; then first=0; else out="$out, "; fi
    if [ -n "$id" ]; then
      out="$out{id: \"$id\", name: \"$s\", color: GRAY, description: \"\"}"
    else
      out="$out{name: \"$s\", color: GRAY, description: \"\"}"
    fi
  done <<< "$TARGETS"
  printf '%s' "$out"
}
OPTS="$(build_options)"

echo ""
echo "-> Resulting Status options (exactly the ten canonical states):"
while IFS= read -r s; do [ -n "$s" ] && echo "     * $s"; done <<< "$TARGETS"

if [ "$APPLY" -ne 1 ]; then
  echo ""
  echo "DRY RUN — nothing changed. Re-run with --apply to retire non-canonical options:"
  echo "  ./tools/retire-legacy-status.sh --apply $OWNER $NUMBER"
  exit 0
fi

echo ""
echo "-> Applying updateProjectV2Field ..."
MUT="mutation { updateProjectV2Field(input: {fieldId: \"$FIELD_ID\", singleSelectOptions: [$OPTS]}) { projectV2Field { __typename } } }"
gh api graphql -f query="$MUT" >/dev/null

# ── re-fetch and assert: exactly the ten, no extras (rule 4) ─────────────────
AFTER="$(gh api graphql -f query="$FIELD_QUERY" --jq '.data.user.projectV2.field.options[].name')"
while IFS= read -r s; do
  [ -z "$s" ] && continue
  case "
$AFTER
" in
    *"
$s
"*) : ;;
    *) echo "  FAIL: '$s' missing after apply"; exit 4 ;;
  esac
done <<< "$TARGETS"
extra=0
while IFS= read -r nm; do
  [ -z "$nm" ] && continue
  is_target "$nm" || { echo "  FAIL: non-canonical '$nm' still present after apply"; extra=$((extra + 1)); }
done <<< "$AFTER"
[ "$extra" -eq 0 ] || exit 4
echo "  ok — Status field now holds exactly the ten canonical states."
