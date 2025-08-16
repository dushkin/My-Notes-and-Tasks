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

# 1) Auto-increment version in package.json
echo "📈 Auto-incrementing version in package.json"
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "   Current version: $CURRENT_VERSION"

# Increment patch version (x.y.z -> x.y.z+1)
NEW_VERSION=$(node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const [major, minor, patch] = pkg.version.split('.').map(Number);
  pkg.version = \`\${major}.\${minor}.\${patch + 1}\`;
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  console.log(pkg.version);
")
echo "   New version: $NEW_VERSION"

# 2) Build web with Vite in DEBUG mode (.env.debug)
echo
echo "📦 Building web assets (Vite --mode debug => loads .env.debug)"
npx vite build --mode debug

# 3) Update Android versionName/versionCode from package.json
echo
echo "📝 Syncing Android versionName/versionCode from package.json"
VERSION=$NEW_VERSION
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

# 4) Capacitor sync
echo
echo "🔄 Running: npx cap sync android"
npx cap sync android

# 5) Build DEBUG APK
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

# 6) Copy APKs into public (not committed)
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

# 7) Clean up backup gradle file
if [[ -f "${GRADLE_FILE}.bak" ]]; then
  echo "🧹 Removing ${GRADLE_FILE}.bak"
  # If ever tracked, untrack it (ignore errors)
  git rm --cached "${GRADLE_FILE}.bak" 2>/dev/null || true
  rm -f "${GRADLE_FILE}.bak"
fi

# 8) Commit AFTER all edits (push ALL changes with AI-generated message)
echo
echo "💾 Preparing to commit ALL changes and build files"

# Check if there are any changes to commit (without staging yet)
if git diff --quiet && git diff --cached --quiet; then
  echo "ℹ️  No changes to commit."
else
  # --- AI Commit Message Generation BEFORE staging ---
  if [ -z "$GOOGLE_API_KEY" ]; then
      echo "❌ Error: GOOGLE_API_KEY environment variable is not set."
      echo "Please export your Google API key before running this script:"
      echo "export GOOGLE_API_KEY=\"YOUR_API_KEY_HERE\""
      exit 1
  fi

  # Get the diff that WOULD BE staged (but don't stage yet)
  STAGED_DIFF=$(git diff --stat)
  STAGED_DIFF_SAMPLE=$(git diff | head -n 200)

  echo "🤖 Asking the AI to generate a commit message..."

  # Create a summary of changes for the AI, excluding version-only changes
  CHANGED_FILES=$(git diff --name-only | tr '\n' ', ' | sed 's/,$//')
  
  # Get diff excluding version/build files to focus on meaningful changes  
  MEANINGFUL_DIFF=$(git diff -- ':!package.json' ':!package-lock.json' ':!android/app/build.gradle' | head -n 150)
  VERSION_DIFF=$(git diff -- 'package.json' 'android/app/build.gradle' | head -n 50)
  
  # Check if we have meaningful changes beyond version bumps
  if [ -n "$MEANINGFUL_DIFF" ]; then
    CHANGES_SUMMARY="Files changed: $CHANGED_FILES\n\nMeaningful code changes (excluding version files):\n$MEANINGFUL_DIFF\n\nVersion/build changes:\n$VERSION_DIFF\n\nDiff stats:\n$STAGED_DIFF"
    PRIORITY_INSTRUCTION="IMPORTANT: Focus on the meaningful code changes (new features, bug fixes, improvements) rather than version number updates. The version changes are secondary."
  else
    CHANGES_SUMMARY="Files changed: $CHANGED_FILES\n\nChanges (mainly version/build updates):\n$STAGED_DIFF_SAMPLE\n\nDiff stats:\n$STAGED_DIFF"
    PRIORITY_INSTRUCTION="This appears to be primarily a version/build update with no significant code changes."
  fi

  # Create the JSON payload for the Gemini API
  JSON_PAYLOAD=$(jq -n --arg changes "$CHANGES_SUMMARY" --arg priority "$PRIORITY_INSTRUCTION" \
    '{
      "contents": [
        {
          "parts": [
            {
              "text": "Based on the following git changes summary, suggest a concise commit message in the conventional commit format (e.g., feat: summary, fix: summary, chore: summary).\n\n\($priority)\n\nThe message should have a subject line and an optional, brief body if needed. Prioritize the most important functional changes over version number updates.\n\n\($changes)"
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

  # Check if the commit message was generated successfully by looking for actual API errors
  API_ERROR=$(echo "$API_RESPONSE" | jq -r '.error.message' 2>/dev/null)
  if [ "$COMMIT_MSG" == "null" ] || [ -z "$COMMIT_MSG" ] || [ "$API_ERROR" != "null" ]; then
      echo "❌ Error: Failed to generate AI commit message."
      if [ "$API_ERROR" != "null" ]; then
          echo "API Error: $API_ERROR"
      fi
      echo "Full API Response: $API_RESPONSE"
      echo "⚠️  Exiting without staging files to avoid leaving them in staged state."
      exit 1
  fi

  echo -e "📄 Generated Commit Message:\n---\n$COMMIT_MSG\n---"

  # NOW stage the files since AI commit message generation succeeded
  echo "📦 Staging all changes for commit..."
  git add . 2>/dev/null || true

  git commit -m "$COMMIT_MSG"
  
  # Get current branch name
  CURRENT_BRANCH=$(git branch --show-current)
  
  echo "⬆️  Pushing to origin $CURRENT_BRANCH"
  git push origin "$CURRENT_BRANCH"
  
  # Create and push the tag
  echo "🏷️  Creating and pushing tag v$VERSION"
  git tag -a "v$VERSION" -m "Release v$VERSION" || echo "⚠️  Tag v$VERSION might already exist"
  git push origin "v$VERSION" || echo "⚠️  Failed to push tag v$VERSION"
fi

echo
echo "🎉 Done. Debug build used .env.debug; Gradle + manifest files were committed (APK not committed)."
