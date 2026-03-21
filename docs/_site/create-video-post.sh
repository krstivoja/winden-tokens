#!/bin/bash

# Script to create a blog post from a YouTube video
# Usage: ./create-video-post.sh <youtube-url>

if [ -z "$1" ]; then
  echo "Usage: ./create-video-post.sh <youtube-url>"
  echo "Example: ./create-video-post.sh https://youtu.be/DBpWtI3KMyY"
  exit 1
fi

YOUTUBE_URL="$1"

# Extract video ID from URL
VIDEO_ID=$(echo "$YOUTUBE_URL" | sed -E 's/.*((youtu\.be\/)|(watch\?v=))([^&?]*).*/\4/')

echo "📹 Extracting transcript from YouTube video: $VIDEO_ID"
echo "🤖 This requires yt-dlp with --write-auto-sub or YouTube Transcript API"
echo ""

# Check if yt-dlp is installed
if ! command -v yt-dlp &> /dev/null; then
    echo "❌ yt-dlp is not installed"
    echo ""
    echo "📦 Install it with: brew install yt-dlp"
    echo ""
    echo "Alternatively, you can:"
    echo "1. Copy the YouTube URL"
    echo "2. Ask Claude Code to extract the transcript and create a post"
    echo "3. Use this command: Ask Claude to create a tutorial post from: $YOUTUBE_URL"
    exit 1
fi

# Create temporary directory for transcript
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

echo "⬇️  Downloading video metadata and transcript..."

# Download video info and subtitles
yt-dlp --write-auto-sub --sub-lang en --skip-download --write-info-json "$YOUTUBE_URL" 2>/dev/null

# Find the subtitle file
SUBTITLE_FILE=$(find . -name "*.en.vtt" -o -name "*.en.srt" | head -n 1)
INFO_FILE=$(find . -name "*.info.json" | head -n 1)

if [ -z "$SUBTITLE_FILE" ]; then
    echo "❌ Could not extract transcript. The video may not have captions."
    echo ""
    echo "💡 Try asking Claude Code directly:"
    echo "   'Create a tutorial post from this YouTube video: $YOUTUBE_URL'"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Extract title from info.json
TITLE=$(grep -o '"title": *"[^"]*"' "$INFO_FILE" | head -n 1 | sed 's/"title": *"\(.*\)"/\1/')

echo "✅ Transcript extracted!"
echo "📝 Video title: $TITLE"
echo ""
echo "🤖 Now ask Claude Code to create the post:"
echo ""
echo "---"
echo "Claude, create a tutorial blog post from this transcript:"
echo ""
echo "Title: $TITLE"
echo "YouTube URL: $YOUTUBE_URL"
echo ""
echo "Transcript:"
cat "$SUBTITLE_FILE"
echo ""
echo "---"
echo ""
echo "Format it as a Jekyll post in docs/_posts/tutorials/ with:"
echo "- YAML front matter with title and youtube field"
echo "- Introduction"
echo "- Key sections from the video"
echo "- Conclusion"
echo ""

# Cleanup
rm -rf "$TEMP_DIR"
