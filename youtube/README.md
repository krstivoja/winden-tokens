# YouTube Videos

This directory contains metadata and individual markdown files for all YouTube tutorial videos for Winden Tokens.

## Individual Video Files

Each video has its own markdown file with SEO-optimized titles, metadata, and comma-separated tags:

### Installation & Getting Started

1. **[2026-01-28-install-winden-tokens-developer-version.md](2026-01-28-install-winden-tokens-developer-version.md)**
   - Title: "Complete Guide: Install Winden Tokens Figma Plugin Developer Version"
   - YouTube: https://youtu.be/jv-OrR9AhR0
   - Level: Beginner
   - Tags: figma plugin, winden tokens, installation guide, developer tools, figma development, plugin setup, design tokens
   - Tutorial Post: [docs/_posts/tutorials/2026-01-28-how-to-install-developers-version.md](../docs/_posts/tutorials/2026-01-28-how-to-install-developers-version.md)

2. **[2026-01-28-winden-tokens-design-system-plugin.md](2026-01-28-winden-tokens-design-system-plugin.md)**
   - Title: "Winden Tokens: The Ultimate Figma Plugin for Design System Management"
   - YouTube: https://youtu.be/QYAq2m1BZgs
   - Level: Beginner
   - Tags: design system, figma plugin, design tokens, winden tokens, token management, figma variables, design workflow
   - Tutorial Post: [docs/_posts/tutorials/2026-01-28-winden-tokens-figma-plugin-introduction.md](../docs/_posts/tutorials/2026-01-28-winden-tokens-figma-plugin-introduction.md)

### Updates & Features

3. **[2026-03-10-winden-tokens-latest-updates.md](2026-03-10-winden-tokens-latest-updates.md)**
   - Title: "What's New in Winden Tokens: Latest Features and Updates"
   - YouTube: https://youtu.be/DBpWtI3KMyY
   - Level: Intermediate
   - Tags: plugin update, new features, winden tokens, figma plugin, design tokens, release notes, plugin features
   - Tutorial Post: [docs/_posts/tutorials/2026-03-10-winden-tokens-march-update.md](../docs/_posts/tutorials/2026-03-10-winden-tokens-march-update.md)

4. **[2026-03-14-master-winden-tokens-workflows.md](2026-03-14-master-winden-tokens-workflows.md)**
   - Title: "Master Winden Tokens: Essential Workflows for Design Token Management"
   - YouTube: https://youtu.be/UVUpNJs8kmA
   - Level: Intermediate
   - Tags: design tokens, workflow tutorial, figma plugin, token management, design system, winden tokens, productivity tips
   - Tutorial Post: [docs/_posts/tutorials/2026-03-14-winden-tokens-tutorial.md](../docs/_posts/tutorials/2026-03-14-winden-tokens-tutorial.md)

### Advanced Topics

5. **[2026-03-16-advanced-winden-tokens-techniques.md](2026-03-16-advanced-winden-tokens-techniques.md)**
   - Title: "Advanced Winden Tokens Techniques: Power User Guide"
   - YouTube: https://youtu.be/LZJfjSNlLQE
   - Level: Advanced
   - Tags: advanced tutorial, power user, design tokens, figma plugin, winden tokens, design system architecture, token strategies
   - Tutorial Post: [docs/_posts/tutorials/2026-03-16-winden-tokens-advanced-features.md](../docs/_posts/tutorials/2026-03-16-winden-tokens-advanced-features.md)

6. **[2026-03-20-building-themes-winden-tokens.md](2026-03-20-building-themes-winden-tokens.md)**
   - Title: "Building Themes with Winden Tokens: Light Mode, Dark Mode & Beyond"
   - YouTube: https://youtu.be/RseXDep1fSk
   - Level: Advanced
   - Tags: theming, dark mode, light mode, design tokens, figma variables, multi-mode, theme management, winden tokens
   - Tutorial Post: [docs/_posts/tutorials/2026-03-20-winden-tokens-theming.md](../docs/_posts/tutorials/2026-03-20-winden-tokens-theming.md)

## Files

- **videos.json** - Complete metadata for all videos in JSON format
- **README.md** - This file, overview and quick reference

## Adding New Videos

To add a new video tutorial:

1. Add video metadata to `videos.json`
2. Create tutorial post in `docs/_posts/tutorials/`
3. Update this README with the new video link
4. Ensure YouTube ID is in the post front matter

## Video Metadata Structure

Each video in `videos.json` includes:
- `date` - Publication date (YYYY-MM-DD)
- `url` - YouTube URL
- `videoId` - YouTube video ID
- `title` - Original YouTube title
- `postFile` - Path to the tutorial post
- `postTitle` - Cleaned post title
- `tags` - Categories and tags for the post

## Notes

- Video embeds are handled by the Jekyll layout using the `youtube` front matter field
- Titles in posts are cleaned to remove redundant dates
- All posts follow the same structure for consistency
