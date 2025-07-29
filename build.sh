#!/bin/bash

# Stage all changes first
echo "📋 Staging all changes..."
git add .

# Fetch staged diff
STAGED_DIFF=$(git diff --cached)

# If no staged changes, exit
if [ -z "$STAGED_DIFF" ]; then
  echo "No changes to commit."
  exit 1
fi

echo "🤖 Asking the AI to generate a commit message..."

# Check if API key is set
if [ -z "$GEMINI_API_KEY" ]; then
  echo "Warning: GEMINI_API_KEY not set. Using fallback commit message."
  # Generate a simple commit message based on file changes
  CHANGED_FILES=$(git diff --cached --name-only | head -5 | tr '\n' ', ' | sed 's/,$//')
  COMMIT_MESSAGE="chore: update $CHANGED_FILES"
  git commit -m "$COMMIT_MESSAGE"
  exit 0
fi

# Write the diff to a temporary file (to handle large diffs)
TEMP_DIFF_FILE=$(mktemp)
TEMP_JSON_FILE=$(mktemp)

# Truncate diff if it's too large (first 500,000 characters - well within Gemini limits)
echo "$STAGED_DIFF" | head -c 500000 > "$TEMP_DIFF_FILE"
if [ ${#STAGED_DIFF} -gt 500000 ]; then
  echo -e "\n\n... (diff truncated for API limits)" >> "$TEMP_DIFF_FILE"
fi

# Create JSON payload using a file to avoid argument length issues
DIFF_CONTENT=$(cat "$TEMP_DIFF_FILE")
rm "$TEMP_DIFF_FILE"

# Use printf to safely escape the diff content
printf '{\n  "contents": [{\n    "parts": [{\n      "text": %s\n    }]\n  }]\n}' "$(printf '%s' "Based on the following git diff, suggest a concise commit message in the conventional commit format (e.g., feat: summary). The message should be under 72 characters.\n\nDiff:\n---\n$DIFF_CONTENT" | jq -Rs .)" > "$TEMP_JSON_FILE"

# Send to Gemini API
API_RESPONSE=$(curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d @"$TEMP_JSON_FILE")

rm "$TEMP_JSON_FILE"

# Extract commit message from Gemini response
COMMIT_MESSAGE=$(echo "$API_RESPONSE" | jq -r '.candidates[0].content.parts[0].text // empty' | head -1 | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')

# Fallback if extraction fails
if [ -z "$COMMIT_MESSAGE" ]; then
  echo "Warning: Failed to generate AI commit message. Using fallback."
  echo "API Response: $API_RESPONSE"
  # Generate a simple commit message based on file changes
  CHANGED_FILES=$(git diff --cached --name-only | head -3 | tr '\n' ', ' | sed 's/,$//')
  COMMIT_MESSAGE="chore: update $CHANGED_FILES"
fi

# Clean up commit message (remove quotes, limit length)
COMMIT_MESSAGE=$(echo "$COMMIT_MESSAGE" | sed 's/^["'"'"']//;s/["'"'"']$//' | head -c 72)

echo "Generated commit message: $COMMIT_MESSAGE"

# Commit with AI-generated message
git commit -m "$COMMIT_MESSAGE"

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")

# Push to dev branch and tag with version
echo "🚀 Pushing to dev branch and tagging with version $VERSION..."
git push origin dev
git tag "v$VERSION"
git push origin "v$VERSION"

echo "✅ Build completed: committed, pushed to dev, and tagged as v$VERSION"
