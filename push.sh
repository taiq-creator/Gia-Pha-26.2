#!/usr/bin/env bash
# Simple helper to add, commit and push all changes.
# Usage: ./push.sh "Commit message"

set -e

MESSAGE=${1:-"auto commit $(date +'%Y-%m-%d %H:%M:%S')"}

git add -A
# Check if there is anything to commit
if git diff --cached --quiet; then
  echo "No changes to commit."
  exit 0
fi

git commit -m "$MESSAGE"
# Push to the current branch's upstream (or specify origin/main)
if git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
  git push
else
  # No upstream set, push to origin main by default
  git push origin HEAD:main
fi
