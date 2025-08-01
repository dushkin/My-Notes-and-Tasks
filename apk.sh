#!/bin/bash

echo "🏗️ Building production APK..."

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
echo "📦 App version: $VERSION"

# Build the web assets first
echo "📦 Building web assets..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Web build failed!"
    exit 1
fi

# Sync with Capacitor
echo "🔄 Syncing with Capacitor..."
npx cap sync android

if [ $? -ne 0 ]; then
    echo "❌ Capacitor sync failed!"
    exit 1
fi

# Build release APK using Gradle (since --release flag is not supported)
echo "🤖 Building release APK..."
cd android

# Use gradlew.bat on Windows, gradlew on Unix
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    ./gradlew.bat assembleRelease
else
    ./gradlew assembleRelease
fi

if [ $? -ne 0 ]; then
    echo "❌ APK build failed!"
    exit 1
fi

cd ..

# Show the APK location (check both signed and unsigned variants)
APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
if [ ! -f "$APK_PATH" ]; then
    APK_PATH="android/app/build/outputs/apk/release/app-release-unsigned.apk"
fi
if [ -f "$APK_PATH" ]; then
    APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
    echo "✅ Production APK built successfully!"
    echo "📍 Location: $APK_PATH"
    echo "📊 Size: $APK_SIZE"
    echo ""
    
    # Copy APK to public directory with versioned name for website download
    echo "📱 Updating website download file..."
    VERSIONED_APK_NAME="notask-android-v${VERSION}.apk"
    cp "$APK_PATH" "public/$VERSIONED_APK_NAME"
    
    # Also create a generic symlink/copy for the landing page
    cp "$APK_PATH" "public/notask-android.apk"
    
    echo "✅ APK copied to public/$VERSIONED_APK_NAME for website download"
    echo "✅ Generic copy created at public/notask-android.apk"
    echo ""
    
    echo "🚀 This is a production-ready APK (unsigned)"
    echo "📝 To publish on Play Store, you'll need to sign it with your keystore"
    echo "🌐 Users can download it from your website at:"
    echo "   📱 Latest: /notask-android.apk"
    echo "   📱 Versioned: /$VERSIONED_APK_NAME"
else
    echo "❌ APK not found at expected location!"
    exit 1
fi