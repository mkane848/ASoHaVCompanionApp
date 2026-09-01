#!/bin/bash
# Clean up merged branches from the remote repository
# This script removes branches that have been merged into main

set -e

echo "Cleaning up stale branches..."
echo ""

# Get list of branches merged into main, excluding main itself and HEAD
branches=$(git branch -r --merged origin/main | grep -v "origin/main$" | grep -v "HEAD" | sed 's|origin/||' | sort)

if [ -z "$branches" ]; then
    echo "No stale branches found."
    exit 0
fi

branch_count=$(echo "$branches" | wc -l)
echo "Found $branch_count merged branches to delete:"
echo ""
echo "$branches"
echo ""

read -p "Delete these branches? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "$branches" | while read branch; do
        echo -n "Deleting $branch... "
        if git push origin --delete "$branch" 2>&1 | grep -q "deleted"; then
            echo "✓"
        else
            echo "✗ (may have already been deleted or lack permissions)"
        fi
    done
    echo ""
    echo "Cleanup complete!"
else
    echo "Cancelled."
    exit 1
fi
