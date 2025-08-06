#!/bin/bash

# Release script - promotes dev to main with major version
# Usage: ./release.sh 2.0.0

set -e  # Exit on any error

# Disable git pager to prevent interactive prompts
export GIT_PAGER=cat

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

# Build production APK with new version
echo "🤖 Building production APK for v$VERSION"
./apk.sh

if [ $? -ne 0 ]; then
    echo "❌ APK build failed! Release cancelled."
    exit 1
fi

# Commit the version update and APK files
echo "💾 Committing version update and APK files"
git add package.json package-lock.json public/
if ! git commit -m "Release v$VERSION

✨ Features in this release:
- Production APK build included
- Version: $VERSION
- APK files: notask.apk, notask-v$VERSION.apk"; then
    echo "❌ Git commit failed! Release cancelled."
    exit 1
fi

# Create and push tag
echo "🏷️  Creating tag v$VERSION"
if ! git tag "v$VERSION"; then
    echo "❌ Git tag creation failed! Release cancelled."
    exit 1
fi

# Push dev to main
echo "⬆️  Pushing dev to main"
if ! git push origin dev:main; then
    echo "❌ Git push to main failed! Release cancelled."
    exit 1
fi

# Push the new tag
echo "🏷️  Pushing tag to origin"
if ! git push origin "v$VERSION"; then
    echo "❌ Git tag push failed! Release cancelled."
    exit 1
fi

echo "✅ Release $VERSION completed successfully!"
echo "🎉 Production is now running version $VERSION"

# Optional: Show the tag info
echo ""
echo "📋 Release info:"
git --no-pager show --stat "v$VERSION"