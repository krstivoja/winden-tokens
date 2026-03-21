# Winden Tokens

A powerful Figma plugin for managing design tokens (variables) with advanced features for color generation, scale management, visual relationship editing, and bulk operations.

Gives you the ability to manage Design Tokens with a spreadsheet-style interface for fast bulk editing. Generate complete color shade palettes with advanced Bezier curve controls, define number scales with preset ratios, and visualize token relationships through interactive node graphs—all from one unified tool.

Create and update your tokens using the intuitive UI or import/export via JSON. Modify multiple values simultaneously, create variable aliases with `{variableName}` syntax, see how colors and numbers connect through visual node editors, and ensure your color combinations meet accessibility standards.



## Supported Features

**Color Management**
- Complete shade palette generation (50-900) from any base color
- Advanced Bezier curve editor for lightness, saturation, and hue control
- Real-time contrast checking against WCAG 2.1 guidelines

**Number Scales**
- Define mathematical ratios for design system progression (typography, spacing, sizing)
- Preset ratios: Minor Third, Major Third, Perfect Fourth, Golden Ratio, and more
- Preset naming: T-shirt sizes (xs-3xl), Numeric (1-10), Gutenberg, or custom

**Bulk Editing**
- Spreadsheet-style interface for simultaneous token editing
- Select, modify, and update values across entire collections
- JSON editor for batch imports and exports

**Node Colors**
- Visual node graph showing color variable relationships
- Drag connection points to create or remove variable aliases
- Group-based layout with draggable headers for organization
- Pan/zoom controls with keyboard shortcuts

**Node Numbers**
- Visual node graph for numeric (FLOAT) variable relationships
- Same powerful interface as Node Colors for spacing, sizing, and typography tokens
- Trace references and dependencies at a glance

**Variable Aliasing**
- Reference tokens with `{variableName}` syntax
- Create semantic color and number tokens that point to primitives
- Visual connection lines show alias relationships

**Accessibility**
- Automatic contrast ratio calculation
- Foreground/background color pair verification
- WCAG 2.1 compliance indicators



## Variable Types

Supports all Figma variable types:
- `COLOR` — displayed as rgb()/rgba() in UI
- `FLOAT` — numeric values
- `STRING` — text values
- `BOOLEAN` — true/false



## Usage Guide

1. **Create tokens** — Use the spreadsheet interface to add new variables to your collections
2. **Generate shades** — Select a base color and fine-tune with Bezier curves for lightness, saturation, and hue
3. **Generate scales** — Create number progressions with preset or custom ratios for typography and spacing
4. **Bulk edit** — Select multiple tokens and modify values in one operation
5. **Check contrast** — Verify color pairs meet accessibility requirements
6. **Node Colors** — Visualize and edit color relationships by dragging connections between variables
7. **Node Numbers** — Same visual editing for numeric tokens—spacing, sizing, typography scales
8. **Export/Import** — Use the JSON editor for batch updates or external sync



## Getting Started

After installing the plugin, access it via Plugins menu in Figma. Import your existing variables or create new collections from scratch.



## Open Source

This plugin is open source! Feel free to contribute, report issues, or suggest features at https://github.com/krstivoja/winden-tokens
