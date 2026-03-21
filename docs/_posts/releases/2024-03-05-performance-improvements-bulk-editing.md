---
title: "10x Faster: Major Performance Improvements for Bulk Editing"
date: 2024-03-05
version: 1.1.5
---

We've just shipped a major performance update that makes bulk editing **up to 10x faster** for large design systems! 🚀

## The Problem

Many of you manage design systems with hundreds or even thousands of tokens. We heard your feedback: editing large token sets was getting sluggish, especially when:

- Updating multiple variables at once
- Working with color shades (50+ tokens per palette)
- Bulk importing from JSON files

## What We Fixed

### 1. Optimized Variable Updates (5x faster)

We rewrote our variable update logic to batch Figma API calls. Instead of making individual updates, we now:

- Group updates into batches of 100
- Use async processing
- Cache unchanged values

**Result**: Updating 500 tokens now takes ~2 seconds instead of ~10 seconds.

### 2. Smarter Re-rendering (3x faster UI)

The spreadsheet view now uses virtual scrolling and smart diffing:

- Only visible rows are rendered
- Changed cells update individually
- Scroll performance is buttery smooth even with 1000+ rows

### 3. JSON Import Optimization (8x faster)

Large JSON imports are now processed in workers:

- Non-blocking UI during import
- Progress indicators for large files
- Validation happens before import (fail fast)

## Benchmarks

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Edit 100 tokens | 4.2s | 0.8s | **5.2x faster** |
| Edit 500 tokens | 22.1s | 2.1s | **10.5x faster** |
| Import 200 tokens | 8.5s | 1.1s | **7.7x faster** |
| Scroll 1000 rows | Janky | Smooth | **60fps** |

*Tested on M1 Mac with Figma Desktop*

## What's Next

We're not done! Coming soon:

- ⚡ Real-time collaboration without conflicts
- 📊 Undo/redo for bulk operations
- 🔍 Faster search and filtering

## Try It Now

Update to the latest version in Figma:
1. Plugins → Manage Plugins
2. Find "Winden Tokens"
3. Click "Update"

Let us know how it performs for your design system! Drop your feedback in [our GitHub issues](https://github.com/krstivoja/winden-tokens/issues).

---

*Performance metrics based on internal testing with real-world design systems. Your mileage may vary based on system complexity and hardware.*
