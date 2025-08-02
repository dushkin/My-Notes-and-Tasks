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
if [ -z "$GOOGLE_API_KEY" ]; then
  echo "Warning: GOOGLE_API_KEY not set. Using smart fallback commit message."
  # Generate a smart commit message based on file changes
  CHANGED_FILES=$(git diff --cached --name-only)
  
  # Analyze what type of changes were made (prioritize code changes over version bumps)
  if echo "$CHANGED_FILES" | grep -q "icon\|favicon\|logo\|png$\|jpg$\|jpeg$\|svg$"; then
    COMMIT_MESSAGE="feat: update app icons and images"
  elif echo "$CHANGED_FILES" | grep -q "\.tsx$\|\.jsx$\|\.ts$\|\.js$"; then
    COMMIT_MESSAGE="feat: update components and functionality"
  elif echo "$CHANGED_FILES" | grep -q "\.css$\|\.scss$\|style"; then
    COMMIT_MESSAGE="style: update styling and appearance"
  elif echo "$CHANGED_FILES" | grep -q "test\|spec"; then
    COMMIT_MESSAGE="test: update tests"
  elif echo "$CHANGED_FILES" | grep -q "README\|doc\|\.md$"; then
    COMMIT_MESSAGE="docs: update documentation"
  elif echo "$CHANGED_FILES" | grep -q "package.json\|version"; then
    VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
    COMMIT_MESSAGE="chore(release): v$VERSION"
  else
    # Fallback to file-based message
    FIRST_FILES=$(echo "$CHANGED_FILES" | head -3 | tr '\n' ', ' | sed 's/,$//')
    COMMIT_MESSAGE="chore: update $FIRST_FILES"
  fi
  
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
# Get list of changed files for context
CHANGED_FILES=$(git diff --cached --name-only | head -5 | tr '\n' ', ' | sed 's/,$//')

printf '{\n  "contents": [{\n    "parts": [{\n      "text": %s\n    }]\n  }]\n}' "$(printf '%s' "Based on the following git diff, generate a concise commit message in conventional commit format (e.g., feat: summary). 

IMPORTANT GUIDELINES:
- PRIORITIZE actual code/functionality changes over version bumps
- If components (.jsx/.tsx/.js/.ts) are changed, use 'feat: update components and functionality'
- If styles (.css/.scss) are changed, use 'style: update styling and appearance'  
- If icons/images are changed, use 'feat: update app icons and images'
- If it's ONLY version changes with no code changes, use 'chore(release): vX.X.X'
- If it's bug fixes, use 'fix: description'
- Keep under 72 characters
- Focus on WHAT the code changes do, not just which files changed

Changed files: $CHANGED_FILES

Diff:
---
$DIFF_CONTENT" | jq -Rs .)" > "$TEMP_JSON_FILE"

# Send to Gemini API
API_RESPONSE=$(curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$GOOGLE_API_KEY" \
  -H "Content-Type: application/json" \
  -d @"$TEMP_JSON_FILE")

rm "$TEMP_JSON_FILE"

# Extract commit message from Gemini response
COMMIT_MESSAGE=$(echo "$API_RESPONSE" | jq -r '.candidates[0].content.parts[0].text // empty' | head -1 | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')

# Fallback if extraction fails
if [ -z "$COMMIT_MESSAGE" ]; then
  echo "Warning: Failed to generate AI commit message. Using smart fallback."
  echo "API Response: $API_RESPONSE"
  # Generate a smart commit message based on file changes
  CHANGED_FILES=$(git diff --cached --name-only)
  
  # Analyze what type of changes were made (prioritize code changes over version bumps)
  if echo "$CHANGED_FILES" | grep -q "icon\|favicon\|logo\|png$\|jpg$\|jpeg$\|svg$"; then
    COMMIT_MESSAGE="feat: update app icons and images"
  elif echo "$CHANGED_FILES" | grep -q "\.tsx$\|\.jsx$\|\.ts$\|\.js$"; then
    COMMIT_MESSAGE="feat: update components and functionality"
  elif echo "$CHANGED_FILES" | grep -q "\.css$\|\.scss$\|style"; then
    COMMIT_MESSAGE="style: update styling and appearance"
  elif echo "$CHANGED_FILES" | grep -q "test\|spec"; then
    COMMIT_MESSAGE="test: update tests"
  elif echo "$CHANGED_FILES" | grep -q "README\|doc\|\.md$"; then
    COMMIT_MESSAGE="docs: update documentation"
  elif echo "$CHANGED_FILES" | grep -q "package.json\|version"; then
    VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
    COMMIT_MESSAGE="chore(release): v$VERSION"
  else
    # Final fallback to file-based message
    FIRST_FILES=$(echo "$CHANGED_FILES" | head -3 | tr '\n' ', ' | sed 's/,$//')
    COMMIT_MESSAGE="chore: update $FIRST_FILES"
  fi
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
# Test change to build.sh script
