#!/usr/bin/env bash
# Turns a branch name into a URL-safe folder name: "feat/Touch UI" -> "feat-touch-ui".
set -euo pipefail
printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//'
