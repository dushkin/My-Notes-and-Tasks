#!/bin/bash

# Extract values from package.json
VERSION=$(jq -r '.version' package.json)  # Retrieves the version
COMMIT_MESSAGE=$(jq -r '.commitMessage' package.json)  # Retrieves the commit message

# Add all modified files
git add .

# Commit changes with the message from package.json
git commit -m "$COMMIT_MESSAGE"

# Push changes to the remote repository
git push origin main  # Change 'main' to your relevant branch

# Create and push the tag
git tag -a "$VERSION" -m "Release $VERSION – $COMMIT_MESSAGE"
git push origin "$VERSION"

echo "Version $VERSION successfully pushed with commit message: '$COMMIT_MESSAGE'!"
