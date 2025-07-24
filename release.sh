#!/bin/bash

# Release script - promotes dev to main with major version
# Usage: ./release.sh 2.0.0

set -e  # Exit on any error

# Check if version argument is provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide a version number"
    echo "Usage: ./release.sh <version>"
    echo "Example: ./release.sh 2.0.0"
    exit 1
fi

VERSION=$1
echo "🚀 Starting release process for version $VERSION"

# Confirm we're on dev branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "dev" ]; then
    echo "⚠️  Warning: You're not on dev branch (currently on $CURRENT_BRANCH)"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Release cancelled"
        exit 1
    fi
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "❌ Error: You have uncommitted changes. Please commit or stash them first."
    git status --porcelain
    exit 1
fi

# Update package.json version
echo "📝 Updating package.json to version $VERSION"
npm version $VERSION --no-git-tag-version

# Commit the version update
echo "💾 Committing version update"
git add package.json
git commit -m "Release v$VERSION"

# Create and push tag
echo "🏷️  Creating tag v$VERSION"
git tag "v$VERSION"

# Push dev to main
echo "⬆️  Pushing dev to main"
git push origin dev:main

# Push the new tag
echo "🏷️  Pushing tag to origin"
git push origin "v$VERSION"

echo "✅ Release $VERSION completed successfully!"
echo "🎉 Production is now running version $VERSION"

# Optional: Show the tag info
echo ""
echo "📋 Release info:"
git show --stat "v$VERSION"