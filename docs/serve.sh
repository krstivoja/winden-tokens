#!/bin/bash
# Local development server for Jekyll

# Use Homebrew Ruby 3.3 (Jekyll not compatible with Ruby 4.0)
export PATH="/opt/homebrew/opt/ruby@3.3/bin:$PATH"

echo "🚀 Starting Jekyll local server..."
echo "📍 Using Ruby: $(ruby --version)"
echo "📍 Site will be available at: http://localhost:4000/winden-tokens/"
echo "Press Ctrl+C to stop"
echo ""

# Compile the Tailwind stylesheet once, then keep rebuilding it while Jekyll serves
npm --prefix .. run docs:css || exit 1
npm --prefix .. run docs:css:watch &
CSS_WATCH_PID=$!
trap 'kill $CSS_WATCH_PID 2>/dev/null' EXIT

# Use both config files: main config + dev overrides
bundle exec jekyll serve --livereload --config _config.yml,_config_dev.yml
