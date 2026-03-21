#!/bin/bash
# Local development server for Jekyll

# Use Homebrew Ruby 3.3 (Jekyll not compatible with Ruby 4.0)
export PATH="/opt/homebrew/opt/ruby@3.3/bin:$PATH"

echo "🚀 Starting Jekyll local server..."
echo "📍 Using Ruby: $(ruby --version)"
echo "📍 Site will be available at: http://localhost:4000/winden-tokens/"
echo "Press Ctrl+C to stop"
echo ""

# Use both config files: main config + dev overrides
bundle exec jekyll serve --livereload --config _config.yml,_config_dev.yml
