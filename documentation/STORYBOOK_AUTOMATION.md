# Storybook Automation

This project includes **automated story generation** to keep your Storybook components in sync with your source code.

## How It Works

The automation system:

1. **Scans** `src/ui/components/` for all React components (`.tsx` files)
2. **Extracts** component names, props, and interfaces automatically
3. **Generates** basic story files for components without stories
4. **Updates** auto-generated stories when component paths change
5. **Preserves** manually created stories (won't overwrite customizations)

## Usage

### Manual Generation

Run the story generator anytime:

```bash
npm run generate-stories
```

This will:
- Create stories for new components
- Update auto-generated stories if component locations changed
- Skip manually created stories (those without the TODO marker)

### Automatic Generation

Stories are **automatically generated** in two scenarios:

#### 1. Before Starting Storybook

```bash
npm run storybook
```

This runs `generate-stories` first, ensuring all new components have stories before Storybook starts.

#### 2. Before Git Commits

The pre-commit hook automatically:
- Runs the story generator
- Stages any new/updated story files
- Includes them in your commit

This ensures your stories are always up-to-date in version control.

## Generated vs Manual Stories

### Auto-Generated Stories

Auto-generated stories include this marker:

```tsx
// TODO: Add more story variants
```

These stories will be **automatically updated** when:
- Component file paths change (component moved to different folder)
- Import paths need updating

They will **NOT** be updated when:
- Props change (to preserve your customizations)
- You've customized the story

### Manual Stories

Any story **without** the TODO marker is considered manual and will **never** be overwritten.

To convert an auto-generated story to manual, simply remove the `// TODO:` comment.

## Customizing Generated Stories

After generation, you can customize stories however you want:

```tsx
// Before (auto-generated)
export const Default: Story = {
  args: {
    label: 'Sample label',
  },
};

// TODO: Add more story variants  ← Remove this to prevent updates

// After (manual customization)
export const Default: Story = {
  args: {
    label: 'Click me',
    variant: 'primary',
    size: 'large',
  },
};

export const Disabled: Story = {
  args: {
    ...Default.args,
    disabled: true,
  },
};
```

Once you remove the TODO comment, the generator will leave your story alone.

## Component Patterns Excluded

The generator automatically skips:

- `Icons.tsx` (icon library)
- `ResizeHandles.tsx` (utility component)
- `*Context.tsx` (React contexts)
- `*.test.tsx` (test files)
- `*.spec.tsx` (spec files)

These patterns are defined in `scripts/generate-stories.js` (`SKIP_PATTERNS`).

## File Structure

```
src/ui/
├── components/
│   ├── Toolbar.tsx
│   ├── TabBar.tsx
│   └── Modals/
│       ├── InputModal.tsx
│       ├── ColorPickerModal.tsx
│       └── ...
└── stories/
    ├── Toolbar.stories.tsx        (auto-generated)
    ├── TabBar.stories.tsx         (manual - customized)
    ├── InputModal.stories.tsx     (manual - customized)
    └── ColorPickerModal.stories.tsx
```

## Workflow Example

1. **Create a new component**: `src/ui/components/NewButton.tsx`

2. **Run Storybook**:
   ```bash
   npm run storybook
   ```
   → Story is auto-generated: `src/ui/stories/NewButton.stories.tsx`

3. **Customize the story** (optional):
   - Edit the story file
   - Add more variants
   - Remove the `// TODO:` comment to lock it

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Add NewButton component"
   ```
   → Pre-commit hook ensures story is included

5. **Move the component** to `src/ui/components/Buttons/NewButton.tsx`:
   ```bash
   npm run generate-stories
   ```
   → Import path is automatically updated in the story

## Disabling Auto-Generation

### Disable pre-commit hook:

```bash
rm .git/hooks/pre-commit
```

### Run Storybook without generation:

```bash
storybook dev -p 6006
```

(Instead of `npm run storybook`)

## Advanced Customization

To customize the generator behavior, edit `scripts/generate-stories.js`:

- **Skip patterns**: Modify `SKIP_PATTERNS` array
- **Story template**: Edit `generateStoryTemplate()` function
- **Props extraction**: Customize `extractProps()` function
- **Category detection**: Modify path parsing in `generateStoryTemplate()`

## Troubleshooting

### Story not generated

Check if the component matches any skip patterns:
```bash
node scripts/generate-stories.js
```

Look for: `⏭️ Skipping ComponentName (no exports found)`

### Story overwritten unexpectedly

Make sure to remove the `// TODO: Add more story variants` comment from manually created stories.

### Import path wrong

The generator uses relative paths from `src/ui/components/`. If your component is in a subdirectory, the import should be:

```tsx
import { Component } from '../components/SubDir/Component';
```

If this is incorrect, update the path logic in `generateStoryTemplate()`.

## Benefits

- ✅ **Never forget** to create stories for new components
- ✅ **Automatic sync** - stories stay up-to-date with code
- ✅ **Safe** - preserves manual customizations
- ✅ **Fast** - basic coverage for all components instantly
- ✅ **Consistent** - all stories follow the same template
- ✅ **Integrated** - works seamlessly with your Git workflow
