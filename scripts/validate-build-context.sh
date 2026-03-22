#!/usr/bin/env bash
# =============================================================================
# scripts/validate-build-context.sh
# Build context validator — TAP Policy > Authority > Truth
#
# Run this script from the repository root BEFORE invoking `docker build`.
# It exits with code 1 and a descriptive error if any required path is absent,
# preventing cryptic Docker COPY failures mid-build.
#
# Usage:
#   bash scripts/validate-build-context.sh
#
# Integration:
#   Called by CI via .github/workflows/validate.yml (build-context-precheck job)
#   See README.md §"Monorepo Build Requirements" for the canonical path list.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ---------------------------------------------------------------------------
# REQUIRED paths — build fails authoritatively if any of these are missing
# ---------------------------------------------------------------------------
REQUIRED_PATHS=(
  "package.json"
  "package-lock.json"
  ".npmrc"
  "index.html"
  "src"
  "vite.config.ts"
  "tailwind.config.ts"
  "postcss.config.js"
  "components.json"
  "tsconfig.json"
  "tsconfig.app.json"
  "tsconfig.node.json"
  "apps/api/package.json"
  "apps/api/src"
  "apps/api/tsconfig.json"
  "apps/web/package.json"
  "apps/worker/package.json"
)

# ---------------------------------------------------------------------------
# OPTIONAL paths — logged as warnings; missing ones do NOT fail the build
# ---------------------------------------------------------------------------
OPTIONAL_PATHS=(
  "services"
  "scripts/agents"
  "apps/web/src"
  "apps/worker/src"
)

# ---------------------------------------------------------------------------
# Validation logic
# ---------------------------------------------------------------------------
FAILED=0
WARN=0

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║  XPS Build Context Validator  (TAP: Policy > Authority > Truth)     ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "[validate] Checking REQUIRED paths in: ${ROOT_DIR}"
echo ""

for rel_path in "${REQUIRED_PATHS[@]}"; do
  abs_path="${ROOT_DIR}/${rel_path}"
  if [ ! -e "${abs_path}" ]; then
    echo "  [FAIL] REQUIRED path missing: ${rel_path}"
    echo "         → Add this file/directory or remove it from the Dockerfile."
    echo "         → See README.md §'Monorepo Build Requirements' for guidance."
    FAILED=1
  else
    echo "  [ OK ] ${rel_path}"
  fi
done

echo ""
echo "[validate] Checking OPTIONAL paths (warnings only):"
echo ""

for rel_path in "${OPTIONAL_PATHS[@]}"; do
  abs_path="${ROOT_DIR}/${rel_path}"
  if [ ! -e "${abs_path}" ]; then
    echo "  [WARN] Optional path absent (non-fatal): ${rel_path}"
    WARN=1
  else
    echo "  [ OK ] ${rel_path}"
  fi
done

echo ""

if [ "${WARN}" -ne 0 ]; then
  echo "[validate] Note: Some optional paths are absent. This is non-fatal for"
  echo "           the Docker build but may affect optional services at runtime."
  echo ""
fi

if [ "${FAILED}" -ne 0 ]; then
  echo "╔══════════════════════════════════════════════════════════════════════╗"
  echo "║  VALIDATION FAILED — Docker build aborted before it started.        ║"
  echo "║  One or more REQUIRED build context paths are missing.              ║"
  echo "║                                                                      ║"
  echo "║  Resolution:                                                         ║"
  echo "║    1. Ensure the missing file(s) exist in the repository.           ║"
  echo "║    2. Check .dockerignore — it must not exclude required paths.     ║"
  echo "║    3. See README.md §'Monorepo Build Requirements' for the          ║"
  echo "║       authoritative list of required vs. optional subprojects.      ║"
  echo "╚══════════════════════════════════════════════════════════════════════╝"
  echo ""
  exit 1
fi

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║  VALIDATION PASSED — build context is complete and ready.           ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
exit 0
