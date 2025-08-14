#!/bin/bash
# Example of using OpenAI instead of Google Gemini

generate_openai_commit_message() {
    if [ -z "$OPENAI_API_KEY" ]; then
        echo "❌ OPENAI_API_KEY not set"
        return 1
    fi
    
    echo "🤖 Generating commit message with OpenAI..."
    
    # Create prompt for OpenAI
    PROMPT="Based on these git changes, generate a concise conventional commit message:

$CHANGES_SUMMARY

Format: type: description

Types: feat, fix, docs, style, refactor, test, chore, build"
    
    # Call OpenAI API
    API_RESPONSE=$(curl -s -X POST \
        "https://api.openai.com/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $OPENAI_API_KEY" \
        -d "{
            \"model\": \"gpt-3.5-turbo\",
            \"messages\": [{\"role\": \"user\", \"content\": \"$PROMPT\"}],
            \"max_tokens\": 100,
            \"temperature\": 0.3
        }")
    
    # Extract message
    COMMIT_MSG=$(echo "$API_RESPONSE" | jq -r '.choices[0].message.content' 2>/dev/null)
    
    if [ "$COMMIT_MSG" != "null" ] && [ -n "$COMMIT_MSG" ]; then
        echo "✅ OpenAI commit message generated"
        return 0
    else
        echo "❌ OpenAI API failed"
        return 1
    fi
}