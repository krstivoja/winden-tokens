# YouTube Videos

This directory contains metadata and information about all YouTube tutorial videos for Winden Tokens.

## Video List

### Installation & Getting Started

1. **How to Install Developer's Version** (2026-01-28)
   - YouTube: https://youtu.be/jv-OrR9AhR0
   - Post: [docs/_posts/tutorials/2026-01-28-how-to-install-developers-version.md](../docs/_posts/tutorials/2026-01-28-how-to-install-developers-version.md)

2. **Winden Tokens Introduction** (2026-01-28)
   - YouTube: https://youtu.be/QYAq2m1BZgs
   - Post: [docs/_posts/tutorials/2026-01-28-winden-tokens-figma-plugin-introduction.md](../docs/_posts/tutorials/2026-01-28-winden-tokens-figma-plugin-introduction.md)

### Updates & Features

3. **Plugin Update** (2026-03-10)
   - YouTube: https://youtu.be/DBpWtI3KMyY
   - Post: [docs/_posts/tutorials/2026-03-10-winden-tokens-march-update.md](../docs/_posts/tutorials/2026-03-10-winden-tokens-march-update.md)

4. **Core Tutorial** (2026-03-14)
   - YouTube: https://youtu.be/UVUpNJs8kmA
   - Post: [docs/_posts/tutorials/2026-03-14-winden-tokens-tutorial.md](../docs/_posts/tutorials/2026-03-14-winden-tokens-tutorial.md)

### Advanced Topics

5. **Advanced Features** (2026-03-16)
   - YouTube: https://youtu.be/LZJfjSNlLQE
   - Post: [docs/_posts/tutorials/2026-03-16-winden-tokens-advanced-features.md](../docs/_posts/tutorials/2026-03-16-winden-tokens-advanced-features.md)

6. **Theming Tutorial** (2026-03-20)
   - YouTube: https://youtu.be/RseXDep1fSk
   - Post: [docs/_posts/tutorials/2026-03-20-winden-tokens-theming.md](../docs/_posts/tutorials/2026-03-20-winden-tokens-theming.md)

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
