#!/bin/bash
# Local development server for Jekyll

# Use Homebrew Ruby instead of system Ruby
export PATH="/opt/homebrew/opt/ruby/bin:$PATH"

echo "🚀 Starting Jekyll local server..."
echo "📍 Using Ruby: $(ruby --version)"
echo "📍 Site will be available at: http://localhost:4000/winden-tokens/"
echo "Press Ctrl+C to stop"
echo ""

bundle exec jekyll serve --livereload
