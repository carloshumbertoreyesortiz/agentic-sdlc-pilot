#!/usr/bin/env bash
#
# create-e11-fields.sh — US-062 GitHub Project custom-field creator
# Doc:      BACKLOG-AGENTIC-SDLC-001 / US-062 · docs/way-of-work.md §5,§6,§12,§13
# Lineage:  modeled on tools/create-issues.sh + tools/create-e11-issues.sh
#           per US-061; four-rule shell-script gate compliant per US-060.
#
# Creates the Telenor SFB custom fields on the pilot's GitHub Project so the
# board can carry Priority, Size, Type, Sub Epic, SFB Case Number, Business
# Area, Business Analyst, External References, Caller, and Alternate Contact.
#
# Idempotent: fields that already exist are skipped (pipe-free membership check).
# Re-fetch-and-assert: after each create, the field list is re-queried and the
# new field asserted present before continuing (write-and-trust forbidden).
#
# REQUIRES: Project-admin permission on the target ProjectV2. Run by Carlos
#           (the Project owner) — an agent token cannot mutate the Project.
#
#   ./tools/create-e11-fields.sh [owner-login] [project-number]
#   defaults: carloshumbertoreyesortiz  1
#
# NOTE — Sprint (iteration) field is NOT created here: the GraphQL
# createProjectV2Field mutation does not support the ITERATION dataType. Create
# "Sprint" manually in the Project UI (Settings -> + field -> Iteration, 2-week
# cycle) as part of US-064. This script prints a reminder at the end.

set -euo pipefail

OWNER="${1:-carloshumbertoreyesortiz}"
NUMBER="${2:-1}"

echo "-> Owner:   $OWNER"
echo "-> Project: #$NUMBER"

command -v gh >/dev/null 2>&1 || { echo "FAIL: gh CLI not found"; exit 3; }
gh auth status >/dev/null 2>&1 || { echo "FAIL: gh not authenticated"; exit 3; }

# Resolve the ProjectV2 node id (mutations need the id, not the number).
PROJECT_ID="$(gh api graphql -f query="query { user(login: \"$OWNER\") { projectV2(number: $NUMBER) { id } } }" --jq '.data.user.projectV2.id // empty')"
if [ -z "$PROJECT_ID" ]; then
  echo "FAIL: could not resolve ProjectV2 id for $OWNER #$NUMBER (check access / that it is a user project)"
  exit 3
fi
echo "-> Project id: $PROJECT_ID"

# Query that returns the current field names, one per line.
FIELDS_QUERY="query { user(login: \"$OWNER\") { projectV2(number: $NUMBER) { fields(first: 100) { nodes { ... on ProjectV2FieldCommon { name } } } } } }"

# Snapshot existing field names once; membership is a pipe-free case match
# (no grep -q + SIGPIPE race under set -o pipefail — see tools/README.md Bug 6).
EXISTING_FIELDS="$(gh api graphql -f query="$FIELDS_QUERY" --jq '.data.user.projectV2.fields.nodes[].name')"

field_exists() {
  case "
$EXISTING_FIELDS
" in
    *"
$1
"*) return 0 ;;
    *) return 1 ;;
  esac
}

# Re-fetch the field list and assert a field is present (rule 4).
assert_field() {
  local name="$1"
  local after
  after="$(gh api graphql -f query="$FIELDS_QUERY" --jq '.data.user.projectV2.fields.nodes[].name')"
  case "
$after
" in
    *"
$name
"*) echo "  ok  $name" ;;
    *) echo "  FAIL: '$name' not present after create"; exit 4 ;;
  esac
  EXISTING_FIELDS="$after"
}

# Build a singleSelectOptions array literal. $1 = color enum; rest = option names.
build_options() {
  local color="$1"; shift
  local out="" first=1 o
  for o in "$@"; do
    if [ "$first" -eq 1 ]; then first=0; else out="$out, "; fi
    out="$out{name: \"$o\", color: $color, description: \"\"}"
  done
  printf '%s' "$out"
}

create_single_select() {
  local name="$1"; local color="$2"; shift 2
  if field_exists "$name"; then echo "  skip (exists)  $name"; return 0; fi
  local opts q
  opts="$(build_options "$color" "$@")"
  q="mutation { createProjectV2Field(input: {projectId: \"$PROJECT_ID\", dataType: SINGLE_SELECT, name: \"$name\", singleSelectOptions: [$opts]}) { projectV2Field { __typename } } }"
  gh api graphql -f query="$q" >/dev/null
  echo "  created (single-select)  $name"
  assert_field "$name"
}

create_text() {
  local name="$1"
  if field_exists "$name"; then echo "  skip (exists)  $name"; return 0; fi
  local q
  q="mutation { createProjectV2Field(input: {projectId: \"$PROJECT_ID\", dataType: TEXT, name: \"$name\"}) { projectV2Field { __typename } } }"
  gh api graphql -f query="$q" >/dev/null
  echo "  created (text)  $name"
  assert_field "$name"
}

echo "-> Creating single-select fields ..."
create_single_select "Priority" GRAY "P0" "P1" "P2" "P3"
create_single_select "Size" GRAY "S" "M" "L"
create_single_select "Type" GRAY "Feature" "Story" "Task" "Bug" "Incident"
create_single_select "Sub Epic" GRAY \
  "Clean-Up" "New Feature" "Minor Improvements and Bug Fixes" \
  "Major Improvements and Bug Fixes" "Matrix Defect"
create_single_select "Business Area" GRAY \
  "Product" "Content" "DPSS Sales" "Mobile Sales" "Mobile Sales Enterprise" \
  "Mobile Sales Mass Market" "Telesales" "Small / Medium Enterprises" "Dealers" \
  "Customer Success" "Customer Onboarding" "Technical Onboarding" "E-Commerce" \
  "UC & Cloud" "Mobile Order and Delivery" "Customer Service (Consumer & Business)" \
  "Fixed Order and Delivery" "Fault Management" "Invoice and Credit" "Complaints"
create_single_select "Business Analyst" GRAY \
  "Nina Jakobsen" "Erik Lauvli" "Tommy Paulsen" "Espen Sanden" "Erik Moberg" \
  "Ingrid Marie Urdshals" "Piero Notaro" "Johannes Dalholt"
create_single_select "External Reference Type" GRAY "SFB" "Matrix" "Jira" "Other"

echo "-> Creating text fields ..."
create_text "SFB Case Number"
create_text "External Reference Id"
create_text "External Reference URL"
create_text "Caller"
create_text "Alternate Contact"

echo ""
echo "-> Verifying final field set ..."
FINAL="$(gh api graphql -f query="$FIELDS_QUERY" --jq '.data.user.projectV2.fields.nodes[].name')"
for want in "Priority" "Size" "Type" "Sub Epic" "Business Area" "Business Analyst" \
            "External Reference Type" "SFB Case Number" "External Reference Id" \
            "External Reference URL" "Caller" "Alternate Contact"; do
  case "
$FINAL
" in
    *"
$want
"*) : ;;
    *) echo "  MISSING: $want"; exit 4 ;;
  esac
done
echo "  all 12 US-062 fields present."

echo ""
echo "REMINDER: 'Sprint' (iteration) is NOT created by this script — the GraphQL"
echo "API cannot create ITERATION fields. Create it in the Project UI as part of"
echo "US-064 (Settings -> + field -> Iteration -> 2-week cycle)."
echo ""
echo "Done. Existing 60+ issues are NOT migrated (US-062 constraint) — that is a"
echo "separate Carlos-mediated pass with rollback."
