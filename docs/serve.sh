#!/bin/bash
# Local development server for Jekyll

echo "🚀 Starting Jekyll local server..."
echo "📍 Site will be available at: http://localhost:4000/winden-tokens/"
echo "Press Ctrl+C to stop"
echo ""

bundle exec jekyll serve --livereload
