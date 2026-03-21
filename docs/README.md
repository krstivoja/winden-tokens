# Winden Tokens Website

This folder contains the Jekyll-based website for Winden Tokens, deployed to GitHub Pages.

## Structure

- `_posts/` - Blog posts for changelog and updates (format: `YYYY-MM-DD-title.md`)
- `_layouts/` - Jekyll page layouts
- `_config.yml` - Jekyll configuration
- `blog.html` - Blog index page
- `index.html` - Homepage

## Adding a New Blog Post

Create a new file in `_posts/` with the format:

```markdown
---
layout: post
title: "Version X.Y.Z Released"
date: YYYY-MM-DD
categories: release
version: X.Y.Z
---

Your content here...
```

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
