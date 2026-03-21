---
layout: post
title: "How to Install Developer's Version of the Figma Plugin"
date: 2026-01-28
categories: tutorials
tags: [tutorial, video, installation, getting-started, development]
youtube: jv-OrR9AhR0
---

## Overview

This step-by-step tutorial walks you through the complete process of installing the developer's version of Winden Tokens. Whether you're a designer wanting to try the latest features or a developer looking to contribute, this guide covers everything you need to know.

## What You'll Learn

In this tutorial, you'll discover:

- **Prerequisites**: What you need before installing
- **GitHub Setup**: How to access and download the repository
- **Build Process**: Compiling the plugin from source code
- **Figma Installation**: Loading the plugin into Figma
- **Troubleshooting**: Common issues and how to solve them
- **Updating**: How to get the latest updates

## Prerequisites

Before you begin, make sure you have:

- **Figma Desktop App**: Required for loading development plugins
- **Node.js**: Version 14 or higher ([download here](https://nodejs.org/))
- **npm**: Comes with Node.js
- **Git**: For cloning the repository ([download here](https://git-scm.com/))
- **Code Editor** (optional): VSCode, Sublime Text, or any text editor

## Installation Steps

### Step 1: Clone the Repository

Open your terminal and run:

```bash
git clone https://github.com/yourusername/winden-tokens.git
cd winden-tokens
```

### Step 2: Install Dependencies

Install all required npm packages:

```bash
npm install
```

This will download and install all the dependencies listed in `package.json`.

### Step 3: Build the Plugin

Compile the TypeScript code to JavaScript:

```bash
npm run build
```

This creates the compiled plugin files in the `dist/` directory.

### Step 4: Load in Figma

1. Open the **Figma Desktop App** (not the browser version)
2. Go to **Plugins** → **Development** → **Import plugin from manifest**
3. Navigate to your cloned repository folder
4. Select the `manifest.json` file
5. Click **Open**

The plugin is now loaded and ready to use!

## Development Workflow

### Watch Mode

For active development, use watch mode to automatically recompile on changes:

```bash
npm run watch
```

This will monitor your source files and rebuild automatically when you save changes.

### Testing Changes

After making changes:

1. Save your files
2. Wait for the build to complete (if using watch mode)
3. In Figma, go to **Plugins** → **Development** → **Hot reload plugin**
4. Or restart the plugin manually

## Build Commands Reference

Here are all available npm scripts:

```bash
npm run build      # Compile TypeScript to JavaScript
npm run watch      # Watch mode - recompile on changes
npm run lint       # Run ESLint
npm run lint:fix   # Run ESLint with auto-fix
```

## Troubleshooting

### Common Issues

**Issue**: "Node.js version not supported"
- **Solution**: Update Node.js to version 14 or higher

**Issue**: "npm install fails"
- **Solution**: Delete `node_modules` folder and `package-lock.json`, then run `npm install` again

**Issue**: "Plugin doesn't appear in Figma"
- **Solution**: Make sure you're using Figma Desktop, not the browser version

**Issue**: "Build errors"
- **Solution**: Check that all dependencies are installed correctly with `npm install`

**Issue**: "Changes not reflected"
- **Solution**: Use hot reload or restart the plugin in Figma

### Getting Help

If you encounter issues:

1. Check the [GitHub Issues](https://github.com/yourusername/winden-tokens/issues) page
2. Review the [documentation](/winden-tokens/)
3. Open a new issue with details about your problem

## Updating the Plugin

To get the latest updates:

```bash
# Pull latest changes from GitHub
git pull origin main

# Reinstall dependencies (if package.json changed)
npm install

# Rebuild the plugin
npm run build
```

Then reload the plugin in Figma.

## Contributing

Want to contribute to Winden Tokens?

1. Fork the repository on GitHub
2. Create a new branch for your feature
3. Make your changes
4. Test thoroughly
5. Submit a pull request

Check out the [contributing guidelines](https://github.com/yourusername/winden-tokens/blob/main/CONTRIBUTING.md) for more details.

## Next Steps

Now that you have Winden Tokens installed:

1. Watch the [introduction tutorial](/winden-tokens/tutorials/winden-tokens-figma-plugin-introduction)
2. Explore the [design tokens best practices](/winden-tokens/tutorials/design-tokens-best-practices)
3. Check out the [latest features](/winden-tokens/tutorials/winden-tokens-march-update)
4. Read the [complete documentation](/winden-tokens/)

## Related Resources

- [Introduction to Winden Tokens](/winden-tokens/tutorials/winden-tokens-figma-plugin-introduction)
- [March 2025 Update](/winden-tokens/tutorials/winden-tokens-march-update)
- [Design Tokens Best Practices](/winden-tokens/tutorials/design-tokens-best-practices)
- [GitHub Repository](https://github.com/yourusername/winden-tokens)
- [Release Notes](/winden-tokens/releases/)

## Have Questions?

If you need help with installation:

- [Open an issue on GitHub](https://github.com/yourusername/winden-tokens/issues)
- Watch more tutorials in our [tutorial series](/winden-tokens/tutorials/)
- Check the [FAQ section](/winden-tokens/#faq)

---

*Successfully installed? Great! Now start exploring the powerful features of Winden Tokens!*
