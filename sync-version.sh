#!/bin/bash

VERSION=$(jq -r .version package.json)

# Check if the version is already tagged
if git tag | grep -q "v$VERSION"; then
    echo "Version $VERSION already tagged"
else
    echo "Creating Git tag: v$VERSION"
    git tag v$VERSION
    git push --tags
fi