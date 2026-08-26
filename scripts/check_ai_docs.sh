#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

required_files=(
  "AGENTS.md"
  "CLAUDE.md"
  ".github/copilot-instructions.md"
  "docs/README.md"
  "docs/AI_ENGINEERING_SYSTEM.md"
  "docs/AI_EXECUTION_PLAN_TEMPLATE.md"
  ".claude-summary.md"
  ".tasks/current.md"
  "research/README.md"
  "research/APPLICATION_FEEDBACK_REGISTRY.md"
  "research/speech-health/MANDARIN_RECORDING_CORPUS_EVIDENCE_GATE.md"
)

assert_file() {
  local rel="$1"
  if [[ ! -f "${ROOT_DIR}/${rel}" ]]; then
    echo "Missing required file: ${rel}" >&2
    exit 1
  fi
}

assert_contains() {
  local rel="$1"
  local expected="$2"
  if ! grep -qF "${expected}" "${ROOT_DIR}/${rel}"; then
    echo "Expected '${expected}' in ${rel}" >&2
    exit 1
  fi
}

for rel in "${required_files[@]}"; do
  assert_file "${rel}"
done

for rel in "AGENTS.md" "CLAUDE.md" ".github/copilot-instructions.md"; do
  assert_contains "${rel}" ".claude-summary.md"
  assert_contains "${rel}" ".tasks/current.md"
  assert_contains "${rel}" "docs/AI_ENGINEERING_SYSTEM.md"
done

assert_contains "docs/README.md" "AI_ENGINEERING_SYSTEM.md"
assert_contains "docs/README.md" "AI_EXECUTION_PLAN_TEMPLATE.md"
assert_contains "docs/README.md" "../research/README.md"
assert_contains "AGENTS.md" "research/APPLICATION_FEEDBACK_REGISTRY.md"
assert_contains "AGENTS.md" "可复现证据门"
assert_contains "docs/AI_ENGINEERING_SYSTEM.md" "普通话录音语料"

bash "${ROOT_DIR}/scripts/check_research_system.sh"

echo "AI docs harness check passed."
