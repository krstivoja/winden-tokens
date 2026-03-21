# Winden Tokens Website

This folder contains the Jekyll-based website for Winden Tokens, deployed to GitHub Pages.

## Structure

- `_posts/` - Blog posts for changelog and updates (format: `YYYY-MM-DD-title.md`)
- `_layouts/` - Jekyll page layouts
- `_config.yml` - Jekyll configuration
- `blog.html` - Blog index page
- `index.html` - Homepage

## Adding a New Blog Post

Blog posts are organized by category in separate folders:

- **Releases**: `_posts/releases/` - Version announcements and release notes
- **Features**: `_posts/features/` - New feature announcements
- **Tutorials**: `_posts/tutorials/` - How-to guides and best practices

Create a new file in the appropriate category folder with the format:

```markdown
---
title: "Your Title"
date: YYYY-MM-DD
version: X.Y.Z  # optional, for releases
---

Your content here...
```

**Note:** You don't need to specify `layout` or `categories` - they're automatically set based on the folder!

**Examples:**
- Release: `_posts/releases/2024-03-21-version-1-5-0.md` → category: `releases`
- Feature: `_posts/features/2024-03-21-dark-mode.md` → category: `features`
- Tutorial: `_posts/tutorials/2024-03-21-color-palettes-guide.md` → category: `tutorials`

## Local Development

```bash
cd docs
bundle install
bundle exec jekyll serve
```

Visit http://localhost:4000/winden-tokens/

## Deployment

The site is automatically built and deployed via GitHub Actions when changes are pushed to the `main` branch.

- Workflow: `.github/workflows/jekyll.yml`
- Triggers: Pushes to `main` branch that modify `docs/**`
- Deployment: GitHub Pages (https://krstivoja.github.io/winden-tokens/)
