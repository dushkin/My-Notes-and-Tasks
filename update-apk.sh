#!/bin/bash

echo "📱 Updating APK download files..."

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
echo "📦 App version: $VERSION"

APK_SOURCE="android/app/build/outputs/apk/release/app-release-unsigned.apk"
APK_DEST="public/notask.apk"
VERSIONED_APK_NAME="notask-v${VERSION}.apk"
VERSIONED_APK_DEST="public/$VERSIONED_APK_NAME"

if [ -f "$APK_SOURCE" ]; then
    # Copy both generic and versioned APK
    cp "$APK_SOURCE" "$APK_DEST"
    cp "$APK_SOURCE" "$VERSIONED_APK_DEST"
    
    APK_SIZE=$(du -h "$APK_DEST" | cut -f1)
    echo "✅ APK files updated successfully!"
    echo "📍 Generic: $APK_DEST"
    echo "📍 Versioned: $VERSIONED_APK_DEST"
    echo "📊 Size: $APK_SIZE"
    echo "🌐 Will be available at:"
    echo "   📱 Latest: /notask.apk"
    echo "   📱 Versioned: /$VERSIONED_APK_NAME"
else
    echo "❌ APK not found at $APK_SOURCE"
    echo "💡 Run ./apk.sh first to build the APK"
    exit 1
fi