#!/usr/bin/env bash

set -euo pipefail

# Publish Manifesto AI packages from the monorepo root.
# Usage:
#   ./scripts/publish-packages.sh           # build + publish
#   DRY_RUN=1 ./scripts/publish-packages.sh # build + npm publish --dry-run
#   SKIP_BUILD=1 ./scripts/publish-packages.sh # publish only (assumes dist is ready)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE_DIR="${ROOT_DIR}/.npm-cache"

PACKAGES=(
  core
  agent
)

maybe_build() {
  if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
    echo "==> Building packages (apps/playground is excluded)"
    PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
    export PNPM_HOME
    pnpm --filter "./packages/**" build
  else
    echo "==> Skipping build (SKIP_BUILD=1)"
  fi
}

publish_pkg() {
  local pkg="$1"
  local -a extra_args=()

  if [[ "${DRY_RUN:-0}" != "0" ]]; then
    extra_args+=(--dry-run)
  fi

  echo "==> Publishing @manifesto-ai/${pkg} ${extra_args[*]:-}"
  if ((${#extra_args[@]})); then
    (cd "${ROOT_DIR}/packages/${pkg}" && npm_config_cache="${CACHE_DIR}" npm publish --access public "${extra_args[@]}")
  else
    (cd "${ROOT_DIR}/packages/${pkg}" && npm_config_cache="${CACHE_DIR}" npm publish --access public)
  fi
}

main() {
  maybe_build
  for pkg in "${PACKAGES[@]}"; do
    publish_pkg "${pkg}"
  done
  echo "==> Done"
}

main "$@"
