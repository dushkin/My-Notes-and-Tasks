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

# Update Android versionName/versionCode from package.json
echo "📝 Syncing Android versionName/versionCode from package.json"
if [[ -z "${VERSION}" ]]; then
  echo "❌ Could not read version from package.json"
  exit 1
fi
echo "   package.json version: ${VERSION}"

# Compute a monotonic numeric versionCode from semver (major*100000 + minor*1000 + patch)
VERSION_CODE=$(node -e "const v=require('./package.json').version.split('.').map(Number); if(v.length!==3||v.some(isNaN)){console.error('Invalid semver in package.json'); process.exit(2)}; console.log(v[0]*100000+v[1]*1000+v[2]);")

GRADLE_FILE="android/app/build.gradle"
if [[ -f "$GRADLE_FILE" ]]; then
  echo "   Editing $GRADLE_FILE"
  # versionName
  if grep -qE '^[[:space:]]*versionName[[:space:]]+\"[^\"]+\"' "$GRADLE_FILE"; then
    sed -i.bak -E "s/^[[:space:]]*versionName[[:space:]]+\"[^\"]+\"/        versionName \"${VERSION}\"/" "$GRADLE_FILE"
  else
    sed -i.bak -E "/defaultConfig[[:space:]]*\{/a\        versionName \"${VERSION}\"" "$GRADLE_FILE"
  fi
  # versionCode (ensure monotonic increase if existing is higher)
  CURRENT_CODE=$(grep -E '^[[:space:]]*versionCode[[:space:]]+[0-9]+' "$GRADLE_FILE" | head -1 | sed -E 's/[^0-9]*([0-9]+).*/\1/')
  if [[ -n "${CURRENT_CODE:-}" ]] && [[ "$VERSION_CODE" -le "$CURRENT_CODE" ]]; then
    VERSION_CODE=$((CURRENT_CODE + 1))
    echo "   • Bumped versionCode to $VERSION_CODE to keep it monotonic"
  fi
  if grep -qE '^[[:space:]]*versionCode[[:space:]]+[0-9]+' "$GRADLE_FILE"; then
    sed -i.bak -E "s/^[[:space:]]*versionCode[[:space:]]+[0-9]+/        versionCode ${VERSION_CODE}/" "$GRADLE_FILE"
  else
    sed -i.bak -E "/defaultConfig[[:space:]]*\{/a\        versionCode ${VERSION_CODE}" "$GRADLE_FILE"
  fi
else
  echo "⚠️  $GRADLE_FILE not found; skipping Gradle version sync."
fi

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
# Clean up backup gradle file
if [[ -f "${GRADLE_FILE}.bak" ]]; then
  echo "🧹 Removing ${GRADLE_FILE}.bak"
  # If ever tracked, untrack it (ignore errors)
  git rm --cached "${GRADLE_FILE}.bak" 2>/dev/null || true
  rm -f "${GRADLE_FILE}.bak"
fi

echo "💾 Committing version and APK files…"
git add package.json package-lock.json "${GRADLE_FILE}" public/
git commit -m "Release v$VERSION

- Production build (.env.production)
- APK: notask.apk, notask-v$VERSION.apk
- Updated Android versionName/versionCode"

echo "🏷️  Tagging v$VERSION"
git tag "v$VERSION" || true

echo "🔀 Merging dev into main branch"
git checkout main
git pull origin main
git merge dev --no-ff -m "Release v$VERSION: merge dev into main"

echo "⬆️  Pushing main branch"
git push origin main

echo "🔄 Returning to dev branch"
git checkout dev

echo "⬆️  Pushing tag"
git push origin "v$VERSION"

echo "✅ Release $VERSION complete (PRODUCTION env)."
git --no-pager show --stat "v$VERSION" || true
