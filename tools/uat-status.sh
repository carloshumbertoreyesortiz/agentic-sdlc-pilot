#!/usr/bin/env bash
#
# uat-status.sh — US-067: surface UAT documentation status from a provenance
# record, mirroring the CP2 → CP3 gate (scripts/validate-uat.ts) so a human can
# check readiness before promotion without running CI.
# Doc:      docs/way-of-work.md §4 (CP3 gate) · US-067
# Lineage:  read-only companion to scripts/validate-uat.ts; bash-3.2 clean (US-060).
#
# Usage:  ./tools/uat-status.sh [path-to-provenance]   # default: .agent/provenance.json
# Exit:   0 = gate would pass (or inert) · 2 = no file · 4 = UAT incomplete at CP3
set -euo pipefail

f="${1:-.agent/provenance.json}"
if [ ! -f "$f" ]; then
  echo "uat-status: no provenance file at $f" >&2
  exit 2
fi

cp3=$(jq -r '.cp3_approver.identity // ""' "$f")
documented=$(jq -r '.uat_documented // false' "$f")
url=$(jq -r '.uat_evidence_url // ""' "$f")

echo "UAT status (from $f)"
if [ -z "$cp3" ]; then
  echo "  CP3 promotion: not claimed -> UAT gate inert (ordinary CP2 PR)"
  exit 0
fi

echo "  CP3 promotion: claimed by $cp3"
echo "  uat_documented:   $documented"
if [ -n "$url" ]; then
  echo "  uat_evidence_url: $url"
else
  echo "  uat_evidence_url: (empty)"
fi

if [ "$documented" = "true" ] && [ -n "$url" ]; then
  echo "  => PASS: UAT documented with evidence — CP3 may proceed"
  exit 0
fi
echo "  => BLOCKED: UAT incomplete — cannot promote to production (US-067)" >&2
exit 4
