#!/usr/bin/env bash
# Writes a build into the gh-pages branch without touching other deployments.
#   publish-pages.sh publish <target-dir> <source-dir>   target "." = site root (keeps dev/)
#   publish-pages.sh remove  <target-dir>
# Needs GITHUB_TOKEN and GITHUB_REPOSITORY (both set in GitHub Actions).
# PAGES_REMOTE overrides the remote URL (used for local testing).
set -euo pipefail

mode="$1"
target="$2"
source_dir="${3:-}"
[ -n "$source_dir" ] && source_dir="$(cd "$source_dir" && pwd)"

case "$target" in
  . | dev/?*) ;;
  *) echo "refusing unexpected target '$target'" >&2; exit 1 ;;
esac

remote="${PAGES_REMOTE:-https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

if git ls-remote --exit-code --heads "$remote" gh-pages >/dev/null 2>&1; then
  git clone --quiet --depth 1 --branch gh-pages "$remote" "$work"
else
  git init --quiet "$work"
  git -C "$work" checkout --quiet --orphan gh-pages
  git -C "$work" remote add origin "$remote"
fi

cd "$work"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

if [ "$mode" = "publish" ]; then
  if [ "$target" = "." ]; then
    # Replace the root site but keep branch previews.
    find . -mindepth 1 -maxdepth 1 ! -name .git ! -name dev -exec rm -rf {} +
    cp -a "$source_dir"/. .
  else
    rm -rf "$target"
    mkdir -p "$target"
    cp -a "$source_dir"/. "$target"/
  fi
elif [ "$mode" = "remove" ]; then
  [ "$target" = "." ] && { echo "refusing to remove the root site" >&2; exit 1; }
  rm -rf "$target"
else
  echo "unknown mode '$mode'" >&2
  exit 1
fi

# Pages would otherwise run Jekyll and drop files starting with "_".
touch .nojekyll
git add -A
if git diff --cached --quiet; then
  echo "nothing to deploy"
  exit 0
fi
git commit --quiet -m "deploy: ${mode} ${target} (${GITHUB_SHA:-local})"
git push --quiet origin gh-pages
echo "gh-pages updated: ${mode} ${target}"
