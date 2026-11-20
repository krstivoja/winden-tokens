---
layout: post
title: "Early releases: 0.0.1 to 0.0.8"
date: 2026-01-30
categories: releases
tags: [release, v0.0.1, v0.0.8]
excerpt: "Everything shipped in the first seven releases of the Winden Tokens Figma plugin, from the initial variable manager and bulk editing to the contrast checker, relationships view and Vite build."
redirect_from:
  - /blog/releases/version-0.0.1-released/
  - /blog/releases/version-0.0.3-released/
  - /blog/releases/version-0.0.4-released/
  - /blog/releases/version-0.0.5-released/
  - /blog/releases/version-0.0.6-released/
  - /blog/releases/version-0.0.7-released/
  - /blog/releases/version-0.0.8-released/
  - /blog/releases/initial-release/
  - /blog/releases/version-0-1-0-released/
---

The first seven releases of Winden Tokens shipped between January 27 and January 30, 2026.
Here is what each one contained, newest first.
Version 0.0.2 was not published as a separate release.

## Version 0.0.8 (January 30, 2026)

### 🐛 Bug Fixes

- Fixed the contrast dropdown font size and removed drag and drop, as the Figma API does not support it (`8c73dc7`)
- Fixed drag and drop (`fb3dae8`)

### 🔄 Other Changes

- Update release.yml (`d91bcae`)

## Version 0.0.7 (January 29, 2026)

### 🐛 Bug Fixes

- Bug fix for nodes (`099a9b1`)

### 🔨 Code Refactoring

- Refactor React symbol names and update context usage (`f990ed2`)
- Clean up (`ea2389a`)

### 🔄 Other Changes

- Update README.md (`d412f7c`)

## Version 0.0.6 (January 29, 2026)

### 🔄 Other Changes

- Version bump to 0.0.6 (`29ae3fc`)

## Version 0.0.5 (January 29, 2026)

### ✨ New Features

- Update GroupedGraph styles and add dots background (`7f9c56d`)
- Add relationships view and variable cleanup logic (`d8ddeee`)

### 🔄 Other Changes

- Update React and scheduler minified bundles (`96849e6`)

## Version 0.0.4 (January 29, 2026)

### ✨ New Features

- Add ContrastPicker and update table components (`2f483e3`)
- Add images and features to README (`b191c95`)

### 💄 UI/Style Changes

- Unify form controls and update UI sizing (`2906af9`)

### 🔄 Other Changes

- Contrast checker (`30ebd69`)
- Moved to Vite (`8dea5d3`)

## Version 0.0.3 (January 28, 2026)

### 🔄 Other Changes

- Update manifest.json (`e10a2ac`)

## Version 0.0.1 (January 27, 2026)

### ✨ New Features

- Add bulk edit modal for group variables (`11fee41`)
- Add search and filter to tokens table UI (`545e903`)
- Add support for variable references in value parsing (`13233a4`)
- Add initial Figma plugin for variable management (`57dbf94`)

### 🐛 Bug Fixes

- Fix steps modal base value and step selection logic (`8314bf3`)

### 🔨 Code Refactoring

- Refactor UI variable rendering and update polling (`ff52461`)
- Refactor shades modal to support curve editing (`3c06167`)

### 🔄 Other Changes

- Update README.md (`a44dbc5`)
- Initial commit: Figma tokens manager plugin (`c120ceb`)

## Updating

To update to a version in Figma:

1. Go to **Plugins > Development > Import plugin from manifest**
2. Select the updated `manifest.json` file
3. Or pull the latest code and run `npm run build`

---

*Have feedback or questions? [Open an issue on GitHub](https://github.com/krstivoja/winden-tokens/issues)*
