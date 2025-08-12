#!/bin/bash
#
# build.sh — Debug APK builder (uses .env.debug via Vite --mode debug)
# - Builds web assets in DEBUG mode (.env.debug)
# - Syncs Capacitor Android project
# - Updates android/app/build.gradle versionName/versionCode from package.json
# - Builds the DEBUG APK
# - Copies APK into ./public (not committed)
# - Commits AFTER edits, pushing: build.sh, package.json, package-lock.json, android/app/build.gradle
#
set -euo pipefail

clear

echo "==============================="
echo " Notask • DEBUG APK Build"
echo "==============================="
echo

# 1) Build web with Vite in DEBUG mode (.env.debug)
echo "📦 Building web assets (Vite --mode debug => loads .env.debug)"
npx vite build --mode debug

# 2) Update Android versionName/versionCode from package.json
echo
echo "📝 Syncing Android versionName/versionCode from package.json"
VERSION=$(node -p "require('./package.json').version")
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

# 3) Capacitor sync
echo
echo "🔄 Running: npx cap sync android"
npx cap sync android

# 4) Build DEBUG APK
echo
echo "🤖 Building DEBUG APK via Gradle"
pushd android >/dev/null
if [[ "${OSTYPE:-}" == "msys" || "${OSTYPE:-}" == "cygwin" ]]; then
  ./gradlew.bat assembleDebug
else
  ./gradlew assembleDebug
fi
popd >/dev/null

DEBUG_APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
if [[ ! -f "$DEBUG_APK_PATH" ]]; then
  echo "❌ Debug APK not found at $DEBUG_APK_PATH"
  exit 1
fi

# 5) Copy APKs into public (not committed)
echo
echo "📁 Copying APK to ./public (not committed)"
mkdir -p public
DEBUG_VERSIONED_APK_NAME="notask-debug-v${VERSION}.apk"
cp "$DEBUG_APK_PATH" "public/$DEBUG_VERSIONED_APK_NAME"
cp "$DEBUG_APK_PATH" "public/notask-debug.apk"
APK_SIZE=$(du -h "public/notask-debug.apk" | cut -f1 || echo "?")
echo "✅ APKs:"
echo "   • public/$DEBUG_VERSIONED_APK_NAME"
echo "   • public/notask-debug.apk  (${APK_SIZE})"

# 6) Clean up backup gradle file
if [[ -f "${GRADLE_FILE}.bak" ]]; then
  echo "🧹 Removing ${GRADLE_FILE}.bak"
  # If ever tracked, untrack it (ignore errors)
  git rm --cached "${GRADLE_FILE}.bak" 2>/dev/null || true
  rm -f "${GRADLE_FILE}.bak"
fi

# 7) Commit AFTER all edits (push ALL changes with AI-generated message)
echo
echo "💾 Committing ALL changes and build files"
git add . 2>/dev/null || true

if git diff --cached --quiet; then
  echo "ℹ️  No staged changes to commit."
else
  # --- AI Commit Message Generation ---
  if [ -z "$GOOGLE_API_KEY" ]; then
      echo "Warning: GOOGLE_API_KEY not set. Using fallback commit message."
      USE_FALLBACK=true
  else
      USE_FALLBACK=false
  fi

  # Get the staged diff with size limit to avoid "Argument list too long"
  STAGED_DIFF=$(git diff --staged --stat)
  STAGED_DIFF_SAMPLE=$(git diff --staged | head -n 200)

  if [ "$USE_FALLBACK" = true ]; then
      echo "🤖 Generating fallback commit message..."
      # Generate a simple commit message based on file changes
      CHANGED_FILES=$(git diff --cached --name-only)
      if echo "$CHANGED_FILES" | grep -q "android/"; then
          COMMIT_MSG="chore(android): debug build v${VERSION} (versionCode ${VERSION_CODE})"
      elif echo "$CHANGED_FILES" | grep -q "\.jsx$\|\.js$\|\.ts$\|\.vue$"; then
          COMMIT_MSG="feat: update frontend functionality"
      elif echo "$CHANGED_FILES" | grep -q "test\|spec"; then
          COMMIT_MSG="test: update tests"
      elif echo "$CHANGED_FILES" | grep -q "README\|doc\|\.md$"; then
          COMMIT_MSG="docs: update documentation"
      elif echo "$CHANGED_FILES" | grep -q "\.sh$\|script"; then
          COMMIT_MSG="build: update build scripts"
      elif echo "$CHANGED_FILES" | grep -q "package.json\|package-lock.json" && [ $(echo "$CHANGED_FILES" | wc -l) -le 2 ]; then
          COMMIT_MSG="chore(release): v$VERSION"
      else
          FIRST_FILES=$(echo "$CHANGED_FILES" | head -3 | tr '\n' ', ' | sed 's/,$//')
          COMMIT_MSG="chore: update $FIRST_FILES"
      fi
  else
      echo "🤖 Asking the AI to generate a commit message..."

      # Create a summary of changes for the AI
      CHANGED_FILES=$(git diff --cached --name-only | tr '\n' ', ' | sed 's/,$//')
      CHANGES_SUMMARY="Files changed: $CHANGED_FILES\n\nDiff sample (first 200 lines):\n$STAGED_DIFF_SAMPLE\n\nDiff stats:\n$STAGED_DIFF"

      # Create the JSON payload for the Gemini API
      JSON_PAYLOAD=$(jq -n --arg changes "$CHANGES_SUMMARY" \
        '{
          "contents": [
            {
              "parts": [
                {
                  "text": "Based on the following git changes summary, suggest a concise commit message in the conventional commit format (e.g., feat: summary). The message should have a subject line and an optional, brief body if needed.\n\n\($changes)"
                }
              ]
            }
          ]
        }')

      # Debug: Check JSON payload size
      echo "Debug: JSON payload size: $(echo "$JSON_PAYLOAD" | wc -c) characters"

      # Call the Gemini API using the 'gemini-1.5-flash' model
      API_RESPONSE=$(curl -s -X POST \
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "$JSON_PAYLOAD")

      # Debug: Show API response
      echo "Debug: API Response: $API_RESPONSE"

      # Parse the response to get the commit message text and clean it up
      COMMIT_MSG=$(echo "$API_RESPONSE" | jq -r '.candidates[0].content.parts[0].text' 2>/dev/null | sed 's/`//g')

      # Check if the commit message was generated successfully
      if [ "$COMMIT_MSG" == "null" ] || [ -z "$COMMIT_MSG" ] || echo "$API_RESPONSE" | grep -q "error"; then
          echo "Warning: Failed to generate AI commit message. Using fallback."
          echo "API Response: $API_RESPONSE"
          COMMIT_MSG="chore(android): debug build v${VERSION} (versionCode ${VERSION_CODE})"
      fi
  fi

  echo -e "📄 Generated Commit Message:\n---\n$COMMIT_MSG\n---"

  git commit -m "$COMMIT_MSG"
  echo "⬆️  Pushing to origin dev"
  git push origin dev
fi

echo
echo "🎉 Done. Debug build used .env.debug; Gradle + manifest files were committed (APK not committed)."
