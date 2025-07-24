#!/bin/bash

# --- Configuration ---
# 1. Get your API key from Google AI Studio and set it as an environment variable.
#    In your terminal, run: export GOOGLE_API_KEY="YOUR_API_KEY_HERE"
#
if [ -z "$GOOGLE_API_KEY" ]; then
    echo "Error: The GOOGLE_API_KEY environment variable is not set."
    echo "Please get your key from Google AI Studio and run 'export GOOGLE_API_KEY=...'"
    exit 1
fi

# Extract version from package.json
VERSION=$(jq -r '.version' package.json)

# --- AI Commit Message Generation ---

# Add all files to staging so the diff captures everything.
git add .

# Get the staged diff.
STAGED_DIFF=$(git diff --staged)

# If there's no diff, there's nothing to commit.
if [ -z "$STAGED_DIFF" ]; then
    echo "No changes staged for commit."
    exit 0
fi

echo "🤖 Asking the AI to generate a commit message..."

# Create the JSON payload for the Gemini API.
JSON_PAYLOAD=$(jq -n --arg diff "$STAGED_DIFF" \
  '{
    "contents": [
      {
        "parts": [
          {
            "text": "Based on the following git diff, suggest a concise commit message in the conventional commit format (e.g., feat: summary). The message should have a subject line and an optional, brief body if needed.\n\nDiff:\n---\n\($diff)"
          }
        ]
      }
    ]
  }')

# Call the Gemini API using the recommended 'gemini-1.5-flash-latest' model.
API_RESPONSE=$(curl -s -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD")

# Parse the response to get the commit message text and clean it up.
COMMIT_MESSAGE=$(echo "$API_RESPONSE" | jq -r '.candidates[0].content.parts[0].text' | sed 's/`//g')

# Check if the commit message was generated successfully.
if [ "$COMMIT_MESSAGE" == "null" ] || [ -z "$COMMIT_MESSAGE" ]; then
    echo "Error: Failed to generate commit message from AI."
    echo "API Response: $API_RESPONSE"
    exit 1
fi

echo -e "📄 Generated Commit Message:\n---\n$COMMIT_MESSAGE\n---"

# --- Git Operations ---

# Commit changes with the AI-generated message.
git commit -m "$COMMIT_MESSAGE"

# Get current branch name.
CURRENT_BRANCH=$(git branch --show-current)

# Push changes to the current branch.
git push origin "$CURRENT_BRANCH"

# Create and push the tag. The commit message is already stored in the commit,
# so the tag message can be simpler.
git tag -a "$VERSION" -m "Release $VERSION"
git push origin "$VERSION"

echo "✅ Version $VERSION successfully pushed to branch '$CURRENT_BRANCH'!"