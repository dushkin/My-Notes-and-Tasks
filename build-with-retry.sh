#!/bin/bash
# Enhanced version with retry logic and fallbacks

# Function to generate AI commit message with retries
generate_ai_commit_message() {
    local max_retries=3
    local retry_delay=5
    local attempt=1
    
    while [ $attempt -le $max_retries ]; do
        echo "🤖 Attempt $attempt/$max_retries: Asking AI to generate commit message..."
        
        # Call the Gemini API (your existing API call code here)
        API_RESPONSE=$(curl -s -X POST \
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}" \
            -H "Content-Type: application/json" \
            -d "$JSON_PAYLOAD")
        
        # Check for API errors
        API_ERROR=$(echo "$API_RESPONSE" | jq -r '.error.code' 2>/dev/null)
        
        if [ "$API_ERROR" == "null" ] || [ -z "$API_ERROR" ]; then
            # Success - extract commit message
            COMMIT_MSG=$(echo "$API_RESPONSE" | jq -r '.candidates[0].content.parts[0].text' 2>/dev/null | sed 's/`//g')
            if [ "$COMMIT_MSG" != "null" ] && [ -n "$COMMIT_MSG" ]; then
                echo "✅ AI commit message generated successfully"
                return 0
            fi
        fi
        
        # Check for specific error codes
        if [ "$API_ERROR" == "503" ]; then
            echo "⚠️  API overloaded (503). Retrying in ${retry_delay} seconds..."
        elif [ "$API_ERROR" == "429" ]; then
            echo "⚠️  Rate limited (429). Retrying in ${retry_delay} seconds..."
        else
            echo "⚠️  API error: $API_ERROR. Retrying in ${retry_delay} seconds..."
        fi
        
        if [ $attempt -lt $max_retries ]; then
            sleep $retry_delay
            retry_delay=$((retry_delay * 2))  # Exponential backoff
        fi
        
        attempt=$((attempt + 1))
    done
    
    echo "❌ Failed to generate AI commit message after $max_retries attempts"
    return 1
}

# Function to generate fallback commit message
generate_fallback_commit_message() {
    echo "🔄 Generating fallback commit message..."
    
    CHANGED_FILES=$(git diff --name-only | wc -l)
    HAS_MEANINGFUL_CHANGES=$(git diff --name-only -- ':!package.json' ':!package-lock.json' ':!android/app/build.gradle' | wc -l)
    
    if [[ "$HAS_MEANINGFUL_CHANGES" -gt 0 ]]; then
        COMMIT_MSG="feat: build v${VERSION} with improvements

- Updated mobile app functionality
- Enhanced user experience
- Built debug APK v${VERSION}"
    else
        COMMIT_MSG="build: release v${VERSION}

- Auto-increment version to ${VERSION}
- Update Android versionName and versionCode
- Build debug APK"
    fi
    
    echo "✅ Fallback commit message generated"
}

# Main commit logic (insert this where the AI commit logic was)
if [ -n "$GOOGLE_API_KEY" ]; then
    if generate_ai_commit_message; then
        echo -e "📄 AI Generated Commit Message:\n---\n$COMMIT_MSG\n---"
    else
        echo "🔄 Falling back to simple commit message"
        generate_fallback_commit_message
        echo -e "📄 Fallback Commit Message:\n---\n$COMMIT_MSG\n---"
    fi
else
    echo "⚠️  GOOGLE_API_KEY not set, using fallback commit message"
    generate_fallback_commit_message
    echo -e "📄 Fallback Commit Message:\n---\n$COMMIT_MSG\n---"
fi