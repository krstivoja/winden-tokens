# Local Development Guide

## Quick Start

```bash
# Navigate to docs folder
cd docs

# Run local server (with live reload)
./serve.sh
```

Visit: http://localhost:4000/winden-tokens/

The server will automatically reload when you make changes!

## Manual Commands

If you prefer to run commands manually:

```bash
# Install dependencies (first time only)
bundle install

# Start Jekyll server
bundle exec jekyll serve --livereload

# Build only (no server)
bundle exec jekyll build
```

## Why Use Local Preview?

- **See changes instantly** - No need to push to GitHub
- **Debug faster** - See errors immediately
- **Iterate quickly** - Edit and refresh

## Troubleshooting

### Posts not showing?
- Make sure you're in the `docs/` folder
- Run `bundle exec jekyll build` to see build errors
- Check that posts are in correct folders (`_posts/releases/`, etc.)

### Port already in use?
```bash
# Use a different port
bundle exec jekyll serve --port 4001
```

### Dependencies out of date?
```bash
bundle update
```
