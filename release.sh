#!/bin/bash

# Release script - promotes dev to main with explicit PRODUCTION build
# Usage: ./release.sh 2.0.0
# This script builds web assets with --mode production (loads .env.production)

set -e
export GIT_PAGER=cat

if [ -z "$1" ]; then
  echo "❌ Error: Please provide a version number"
  echo "Usage: ./release.sh <version>"
  exit 1
fi

VERSION="$1"
echo "🚀 Starting release process for version $VERSION"

# Ensure on dev (warn if not)
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "dev" ]; then
  echo "⚠️  You're on '$CURRENT_BRANCH', not 'dev'"
  read -p "Continue anyway? (y/N): " -n 1 -r
  echo
  [[ $REPLY =~ ^[Yy]$ ]] || { echo "❌ Release cancelled"; exit 1; }
fi

# Ensure clean working tree
if ! git diff-index --quiet HEAD --; then
  echo "❌ Uncommitted changes present. Commit or stash first."
  git status --porcelain
  exit 1
fi

# Bump package.json version (no tag yet)
echo "📝 Setting package.json to $VERSION"
npm version "$VERSION" --no-git-tag-version

# -----------------------------
# 1) Build web (PRODUCTION env)
# -----------------------------
echo "📦 Building web assets in PRODUCTION mode (loads .env.production)..."
npx vite build --mode production

# -----------------------------
# 2) Capacitor sync
# -----------------------------
echo "🔄 Syncing Android project..."
npx cap sync android

# -----------------------------
# 3) Build RELEASE APK
# -----------------------------
echo "🤖 Building RELEASE APK..."
pushd android > /dev/null

if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
  ./gradlew.bat assembleRelease
else
  ./gradlew assembleRelease
fi

popd > /dev/null

# Determine APK path (signed/unsigned)
APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
if [ ! -f "$APK_PATH" ]; then
  APK_PATH="android/app/build/outputs/apk/release/app-release-unsigned.apk"
fi

if [ ! -f "$APK_PATH" ]; then
  echo "❌ Release APK not found!"
  exit 1
fi

# Copy APK to public
mkdir -p public
VERSIONED_APK_NAME="notask-v${VERSION}.apk"
cp "$APK_PATH" "public/$VERSIONED_APK_NAME"
cp "$APK_PATH" "public/notask.apk"

APK_SIZE=$(du -h "public/notask.apk" | cut -f1)
echo "✅ Release APK ready:"
echo "   📍 public/$VERSIONED_APK_NAME"
echo "   📍 public/notask.apk"
echo "   📊 $APK_SIZE"

# -----------------------------
# 4) Commit, tag, push
# -----------------------------
echo "💾 Committing version and APK files…"
git add package.json package-lock.json public/
git commit -m "Release v$VERSION

- Production build (.env.production)
- APK: notask.apk, notask-v$VERSION.apk"

echo "🏷️  Tagging v$VERSION"
git tag "v$VERSION" || true

echo "⬆️  Pushing dev → main"
git push origin dev:main

echo "⬆️  Pushing tag"
git push origin "v$VERSION"

echo "✅ Release $VERSION complete (PRODUCTION env)."
git --no-pager show --stat "v$VERSION" || true
