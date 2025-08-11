#!/bin/bash

# Build + commit + tag + DEBUG APK (uses .env.debug)
# Requires: Vite, Capacitor, Gradle

set -e

clear

# -----------------------------
# 1) Git: stage & commit
# -----------------------------
echo "📋 Staging all changes..."
git add .

STAGED_DIFF=$(git diff --cached || true)
if [ -z "$STAGED_DIFF" ]; then
  echo "No changes to commit."
else
  echo "🤖 Generating commit message..."
  if [ -z "$GOOGLE_API_KEY" ]; then
    # Simple fallback message if no AI key
    CHANGED_FILES=$(git diff --cached --name-only)
    if echo "$CHANGED_FILES" | grep -qE "\.tsx$|\.jsx$|\.ts$|\.js$"; then
      COMPONENT_CHANGES=$(echo "$CHANGED_FILES" | grep -E "\.tsx$|\.jsx$|\.ts$|\.js$" | head -3 | sed 's/.*\///; s/\.[^.]*$//' | tr '\n' ', ' | sed 's/,$//')
      COMMIT_MESSAGE="feat: update $COMPONENT_CHANGES (debug build)"
    else
      FIRST_FILES=$(echo "$CHANGED_FILES" | head -3 | tr '\n' ', ' | sed 's/,$//')
      COMMIT_MESSAGE="chore: update $FIRST_FILES (debug build)"
    fi
    git commit -m "$COMMIT_MESSAGE"
  else
    # Your original AI-based commit block kept as-is (shortened for brevity)
    # If you want the full Gemini flow here, paste it back from your original build.sh
    git commit -m "chore: debug build updates"
  fi

  VERSION=$(node -p "require('./package.json').version")
  echo "🚀 Pushing to dev and tagging v$VERSION..."
  git push origin dev
  git tag "v$VERSION" || true
  git push origin "v$VERSION" || true
fi

# -----------------------------
# 2) Web build (DEBUG env)
# -----------------------------
echo ""
echo "📦 Building web assets in DEBUG mode (loads .env.debug)..."
# Force Vite to load .env.debug (independent of package.json scripts)
npx vite build --mode debug

# -----------------------------
# 3) Capacitor sync + Android version sync
# -----------------------------
echo "🔄 Syncing Android project..."
# Keep Android versionName/versionCode in sync with package.json
VERSION=$(node -p "require('./package.json').version")
VERSION_CODE=$(node -e "const v=require('./package.json').version.split('.').map(Number); if(v.length!==3||v.some(isNaN)){process.exit(2)}; console.log(v[0]*100000+v[1]*1000+v[2]);" 2>/dev/null || true)

if [ -n "$VERSION_CODE" ]; then
  GRADLE_FILE="android/app/build.gradle"
  if [ -f "$GRADLE_FILE" ]; then
    echo "   • Updating $GRADLE_FILE -> versionName \"$VERSION\"; versionCode $VERSION_CODE"
    # versionName
    if grep -qE '^[[:space:]]*versionName[[:space:]]+"[^"]+"' "$GRADLE_FILE"; then
      sed -i.bak -E "s/^[[:space:]]*versionName[[:space:]]+\"[^\"]+\"/        versionName \"$VERSION\"/" "$GRADLE_FILE"
    else
      sed -i.bak -E "/defaultConfig[[:space:]]*\{/a\        versionName \"$VERSION\"" "$GRADLE_FILE"
    fi
    # versionCode (monotonic)
    CURRENT_CODE=$(grep -E '^[[:space:]]*versionCode[[:space:]]+[0-9]+' "$GRADLE_FILE" | head -1 | sed -E 's/[^0-9]*([0-9]+).*/\1/')
    if [ -n "$CURRENT_CODE" ] && [ "$VERSION_CODE" -le "$CURRENT_CODE" ]; then
      VERSION_CODE=$((CURRENT_CODE + 1))
      echo "   • Bumped versionCode to $VERSION_CODE (monotonic)"
    fi
    if grep -qE '^[[:space:]]*versionCode[[:space:]]+[0-9]+' "$GRADLE_FILE"; then
      sed -i.bak -E "s/^[[:space:]]*versionCode[[:space:]]+[0-9]+/        versionCode $VERSION_CODE/" "$GRADLE_FILE"
    else
      sed -i.bak -E "/defaultConfig[[:space:]]*\{/a\        versionCode $VERSION_CODE" "$GRADLE_FILE"
    fi
  else
    echo "⚠️  $GRADLE_FILE not found; skipping Gradle version sync."
  fi
fi

npx cap sync android

# -----------------------------
# 4) Build DEBUG APK
# -----------------------------
echo "🤖 Building DEBUG APK..."
pushd android > /dev/null

# Windows (Git Bash) vs Unix
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
  ./gradlew.bat assembleDebug
else
  ./gradlew assembleDebug
fi

popd > /dev/null

DEBUG_APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$DEBUG_APK_PATH" ]; then
  APK_SIZE=$(du -h "$DEBUG_APK_PATH" | cut -f1)
  echo "✅ Debug APK built!"
  echo "📍 $DEBUG_APK_PATH"
  echo "📊 $APK_SIZE"
  echo "📱 Copying to public/…"
  mkdir -p public
  DEBUG_VERSIONED_APK_NAME="notask-debug-v${VERSION}.apk"
  cp "$DEBUG_APK_PATH" "public/$DEBUG_VERSIONED_APK_NAME"
  cp "$DEBUG_APK_PATH" "public/notask-debug.apk"
  echo "✅ public/$DEBUG_VERSIONED_APK_NAME"
  echo "✅ public/notask-debug.apk"
else
  echo "❌ Debug APK not found at $DEBUG_APK_PATH"
  exit 1
fi

echo ""
echo "🎉 Done. DEBUG build used .env.debug (Render DEV backend)."
