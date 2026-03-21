# Storybook Quick Start

## 🚀 Getting Started

### View Storybook

```bash
npm run storybook
```

Opens at [http://localhost:6006](http://localhost:6006)

### Build Static Storybook

```bash
npm run build-storybook
```

Output: `.storybook-static/` (not shipped with plugin)

## 📝 Adding Stories for New Components

### Option 1: Automatic (Recommended)

Just run Storybook - stories are auto-generated:

```bash
npm run storybook
```

Or manually generate:

```bash
npm run generate-stories
```

### Option 2: Manual

Create `src/ui/stories/YourComponent.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { YourComponent } from '../components/YourComponent';

const meta = {
  title: 'Category/YourComponent',
  component: YourComponent,
  tags: ['autodocs'],
} satisfies Meta<typeof YourComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    // Your props here
  },
};
```

## 🔄 Auto-Generation Features

### What Happens Automatically

1. **Before Storybook starts**: Stories are generated for all components
2. **Before Git commits**: Stories are generated and staged
3. **Smart updates**: Only auto-generated stories are updated
4. **Manual stories preserved**: Remove `// TODO:` comment to lock a story

### Which Components Get Stories

✅ All `.tsx` files in `src/ui/components/`

❌ Skipped automatically:
- `Icons.tsx`
- `ResizeHandles.tsx`
- `*Context.tsx`
- `*.test.tsx`
- `*.spec.tsx`

## 📚 Current Story Coverage

As of the last generation run:

- **Total component files**: 24
- **Stories created**: 16 (auto-generated)
- **Stories customized**: 8 (manually created)

### All Available Stories

**Modals:**
- InputModal - Text input dialogs
- ColorPickerModal - Color selection
- ShadesModal - Shade generator
- StepsModal - Step generator
- BulkEditModal - Bulk editing
- ColorReferenceModal - Color references

**Table Components:**
- TableView - Main table
- TableRow - Individual row
- GroupHeader - Group headers
- CollectionCell - Collection cells
- GroupCollectionCell - Grouped collections
- ValueCell - Value cells
- ColorMenu - Shared color picker menu (used by ColorValueMenu & ContrastPicker)
- ColorValueMenu - Menu for editing color values (wrapper around ColorMenu)
- ContrastPicker - Menu for WCAG contrast checking (wrapper around ColorMenu)

**Toolbar:**
- Toolbar - Main toolbar
- AddMenu - Add dropdown menu
- CollectionFilters - Filter controls
- ModeSelector - Mode switching
- VariableTypeFilters - Type filters

**Navigation:**
- TabBar - Tab navigation

**Editors:**
- JsonEditor - JSON editing view
- SettingsView - Settings panel

**Visualizations:**
- GroupedGraph - Relationship graphs
- RelationshipsView - Variable relationships

## 🎨 Customizing Stories

### Simple Customization

Edit the auto-generated story:

```tsx
export const Default: Story = {
  args: {
    label: 'Click Me',  // Change values
    variant: 'primary',
  },
};

// Add more variants
export const Disabled: Story = {
  args: {
    ...Default.args,
    disabled: true,
  },
};

// TODO: Add more story variants  ← Remove this to lock the story
```

### Advanced: Multiple Stories

```tsx
export const Default: Story = { args: {...} };
export const Active: Story = { args: {...} };
export const Disabled: Story = { args: {...} };
export const Loading: Story = { args: {...} };
```

### With Decorators

For components needing context (like modals):

```tsx
import { AppProvider } from '../context/AppContext';
import { ModalProvider } from '../components/Modals/ModalContext';

const meta = {
  title: 'Components/MyComponent',
  component: MyComponent,
  decorators: [
    (Story) => (
      <AppProvider>
        <ModalProvider>
          <Story />
        </ModalProvider>
      </AppProvider>
    ),
  ],
} satisfies Meta<typeof MyComponent>;
```

## 🧪 Testing Components in Storybook

### Accessibility

Storybook includes the a11y addon:
- Click the "Accessibility" tab
- View WCAG violations and warnings
- Fix issues directly in your components

### Responsive Testing

- Use the viewport toolbar to test different screen sizes
- Add custom viewports in `.storybook/preview.ts`

### Interactive Props

- Use the "Controls" panel to change props in real-time
- Add custom controls via `argTypes`:

```tsx
argTypes: {
  variant: {
    control: 'select',
    options: ['primary', 'secondary', 'danger'],
  },
  size: {
    control: 'radio',
    options: ['small', 'medium', 'large'],
  },
},
```

## 🔍 Finding Stories

### In Storybook UI

1. Use the sidebar search
2. Navigate by category (Modals, Table, Toolbar, etc.)
3. Click "Docs" tab for auto-generated documentation

### In File System

All stories are in `src/ui/stories/`:

```
src/ui/stories/
├── InputModal.stories.tsx
├── ColorPickerModal.stories.tsx
├── Toolbar.stories.tsx
└── ...
```

## 🚨 Troubleshooting

### Story not showing up

1. Check file ends with `.stories.tsx`
2. Verify it's in `src/ui/stories/`
3. Check for console errors in Storybook
4. Restart Storybook: `npm run storybook`

### Component requires context

Add decorators (see "With Decorators" above)

### Props not detected

Add `argTypes` manually or check your prop interface is exported

### Story being overwritten

Remove the `// TODO: Add more story variants` comment

## 📖 More Information

- [STORYBOOK_AUTOMATION.md](./STORYBOOK_AUTOMATION.md) - Full automation docs
- [STORYBOOK_COMPONENTS.md](./STORYBOOK_COMPONENTS.md) - All components reference
- [Storybook Docs](https://storybook.js.org/docs) - Official documentation

## ⚙️ Configuration Files

- `.storybook/main.ts` - Storybook configuration
- `.storybook/preview.ts` - Global decorators and parameters
- `scripts/generate-stories.js` - Auto-generation script
- `.git/hooks/pre-commit` - Pre-commit hook
