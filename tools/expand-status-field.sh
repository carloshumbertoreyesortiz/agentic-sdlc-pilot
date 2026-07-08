#!/usr/bin/env bash
#
# expand-status-field.sh — US-063 Status-field expansion
# Doc:      BACKLOG-AGENTIC-SDLC-001 / US-063 · docs/way-of-work.md §5
# Lineage:  modeled on tools/create-e11-fields.sh (US-062); four-rule gate
#           compliant per US-060.
#
# Adds the Telenor SFB ten-state status taxonomy to the pilot's Project #1
# Status single-select field:
#   Draft, Backlog, Ready for Development, Analysis, Development,
#   User Acceptance Test, Ready for Deployment, Pending Requestor, Deployed, Done
#
# SAFE BY DESIGN (US-063 AC: "no orphans"):
#   - Sets the field to the ten canonical states (in order), reusing existing
#     option ids where names match (e.g. Done) so items keep their value.
#   - A non-canonical option (e.g. legacy Todo / In Progress / Blocked) is
#     preserved ONLY while an item still uses it, and is otherwise dropped. So
#     during migration nothing orphans, and once items are migrated off a legacy
#     status a re-run retires that option automatically (US-063 cleanup).
#   - REMAPPING existing items (Todo -> Backlog, etc.) is the separate
#     Carlos-mediated migration with rollback — NOT this script.
#
# DRY-RUN BY DEFAULT. Pass --apply to actually mutate the live Status field.
#   ./tools/expand-status-field.sh [--apply] [owner-login] [project-number]
#   defaults: dry-run  carloshumbertoreyesortiz  1
#
# REQUIRES Project-admin permission. Run by Carlos — review the dry-run output
# first; the Status field carries live item statuses.

set -euo pipefail

APPLY=0
if [ "${1:-}" = "--apply" ]; then APPLY=1; shift; fi
OWNER="${1:-carloshumbertoreyesortiz}"
NUMBER="${2:-1}"

command -v gh >/dev/null 2>&1 || { echo "FAIL: gh CLI not found"; exit 3; }

# The ten target states, in order.
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

# Resolve the Status field id + its current options (id<TAB>name per line).
FIELD_QUERY="query { user(login: \"$OWNER\") { projectV2(number: $NUMBER) { field(name: \"Status\") { ... on ProjectV2SingleSelectField { id options { id name } } } } } }"
FIELD_ID="$(gh api graphql -f query="$FIELD_QUERY" --jq '.data.user.projectV2.field.id // empty')"
if [ -z "$FIELD_ID" ]; then echo "FAIL: no Status single-select field on $OWNER #$NUMBER"; exit 3; fi
EXISTING="$(gh api graphql -f query="$FIELD_QUERY" --jq '.data.user.projectV2.field.options[] | .id + "\t" + .name')"

echo "-> Status field: $FIELD_ID"
echo "-> Existing options:"
printf '%s\n' "$EXISTING" | while IFS="$(printf '\t')" read -r _id nm; do echo "     - $nm"; done

# Status values actually in use by items — so a non-canonical option is only
# preserved while something still uses it, and is otherwise dropped. US-063
# hygiene: post-migration this is empty, so the field converges to exactly the
# ten canonical states and a re-run never re-adds retired legacy options.
# Fail-CLOSED: if usage can't be determined, treat every option as in use so we
# never drop an option that might still be referenced (no orphans).
ITEMS_JSON="$(gh project item-list "$NUMBER" --owner "$OWNER" --format json --limit 500 2>/dev/null)" || true
if printf '%s' "$ITEMS_JSON" | jq -e '.items' >/dev/null 2>&1; then
  USAGE_KNOWN=1
  IN_USE="$(printf '%s' "$ITEMS_JSON" | jq -r '.items[].status // empty' | sort -u)"
else
  USAGE_KNOWN=0
  IN_USE=""
  echo "-> WARNING: could not read item statuses — preserving all options (fail-closed)."
fi

in_use() {
  [ "$USAGE_KNOWN" -eq 0 ] && return 0   # usage unknown -> preserve (fail-closed)
  case "
$IN_USE
" in
    *"
$1
"*) return 0 ;;
    *) return 1 ;;
  esac
}

# Look up an existing option id by exact name (empty if absent). Pipe-free
# here-string read (no SIGPIPE race — see tools/README.md Bug 6).
existing_id_for() {
  local want="$1" id nm
  while IFS="$(printf '\t')" read -r id nm; do
    if [ "$nm" = "$want" ]; then printf '%s' "$id"; return 0; fi
  done <<< "$EXISTING"
  return 0
}

# Build the singleSelectOptions array: ten targets in order (reusing existing
# ids where the name already exists, e.g. Done), then legacy extras appended.
build_options() {
  local out="" first=1 s id eid enm
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
  while IFS="$(printf '\t')" read -r eid enm; do
    if is_target "$enm"; then continue; fi
    if ! in_use "$enm"; then continue; fi   # drop non-canonical options no item uses
    out="$out, {id: \"$eid\", name: \"$enm\", color: GRAY, description: \"(non-canonical — still in use; migrate items then re-run to drop)\"}"
  done <<< "$EXISTING"
  printf '%s' "$out"
}

OPTS="$(build_options)"

echo ""
echo "-> Planned Status options (ten canonical states; non-canonical kept only while in use):"
while IFS= read -r s; do [ -n "$s" ] && echo "     * $s"; done <<< "$TARGETS"
while IFS="$(printf '\t')" read -r _eid enm; do
  { is_target "$enm" || ! in_use "$enm"; } || echo "     * $enm  (non-canonical, still in use — preserved)"
done <<< "$EXISTING"

if [ "$APPLY" -ne 1 ]; then
  echo ""
  echo "DRY RUN — nothing changed. Re-run with --apply to update the Status field:"
  echo "  ./tools/expand-status-field.sh --apply $OWNER $NUMBER"
  exit 0
fi

echo ""
echo "-> Applying updateProjectV2Field ..."
MUT="mutation { updateProjectV2Field(input: {fieldId: \"$FIELD_ID\", singleSelectOptions: [$OPTS]}) { projectV2Field { __typename } } }"
gh api graphql -f query="$MUT" >/dev/null

# Re-fetch and assert all ten states are present (rule 4).
AFTER="$(gh api graphql -f query="$FIELD_QUERY" --jq '.data.user.projectV2.field.options[].name')"
while IFS= read -r s; do
  [ -z "$s" ] && continue
  case "
$AFTER
" in
    *"
$s
"*) : ;;
    *) echo "  FAIL: '$s' not present after apply"; exit 4 ;;
  esac
done <<< "$TARGETS"
echo "  ok — all ten SFB states present on the Status field."
echo ""
echo "NOTE: legacy Todo / In Progress / Blocked are KEPT (no orphans). Remapping"
echo "existing items to the new states and removing the legacy options is the"
echo "separate Carlos-mediated migration with rollback (US-063 AC)."
