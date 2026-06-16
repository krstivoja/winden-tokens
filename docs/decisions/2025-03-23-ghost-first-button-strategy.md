# Ghost-First Button Strategy

**Date:** 2025-03-23
**Status:** Accepted
**Decided by:** Orchestrator + User Request

## Context

Previously, our button components had inconsistent default variants:
- **IconButton:** defaulted to `'default'` (solid gray background)
- **TextButton:** defaulted to `'secondary'` (solid gray background)
- **IconTextButton:** defaulted to `'secondary'` (solid gray background)

This created visual heaviness in the UI and required developers to explicitly specify `variant="ghost"` for most buttons to achieve a clean, minimal look.

The user requested:
1. Standardize all ghost button styling to: `bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200`
2. Make ghost the default variant for all button components
3. Establish a rule that buttons should use ghost by default unless explicitly requesting another variant

## Decision

**Adopt a "Ghost-First" button strategy:**

### 1. Standardized Ghost Styling
All button components now use the exact same ghost variant styles:
```css
bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200
```

This provides:
- Transparent background (no visual weight)
- Subtle hover state (light gray background)
- Clear active/pressed state (slightly darker gray)
- Smooth `transition-colors` animation

### 2. Ghost as Default Variant
Changed default variants across all button components:

**Before:**
```tsx
// IconButton
variant = 'default'  // ❌ Solid gray background

// TextButton
variant = 'secondary'  // ❌ Solid gray background

// IconTextButton
variant = 'secondary'  // ❌ Solid gray background
```

**After:**
```tsx
// IconButton
variant = 'ghost'  // ✅ Transparent, minimal

// TextButton
variant = 'ghost'  // ✅ Transparent, minimal

// IconTextButton
variant = 'ghost'  // ✅ Transparent, minimal
```

### 3. Development Rule
**New convention:** When creating buttons, use the default (ghost) variant unless you specifically need emphasis:
- **Ghost (default):** Most buttons - subtle, non-intrusive
- **Primary:** Main call-to-action (Save, Submit, Create)
- **Danger:** Destructive actions (Delete, Remove)
- **Secondary/Default:** Rarely needed - only when you need visible button boundaries

## Implementation

### Modified Files

**Component implementations:**
- `src/ui/components/common/IconButton/IconButton.tsx`
- `src/ui/components/common/TextButton/TextButton.tsx`
- `src/ui/components/common/IconTextButton/IconTextButton.tsx`

**Documentation:**
- `specs/components.md` - Updated all button component documentation

### Code Changes

All three button components now default to `variant = 'ghost'`:

```tsx
// IconButton.tsx
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({
    icon,
    variant = 'ghost', // ← Changed from 'default'
    size = 'md',
    // ...
  }, ref) {
    // ...
  }
);

// TextButton.tsx
export const TextButton = forwardRef<HTMLButtonElement, TextButtonProps>(
  function TextButton({
    variant = 'ghost', // ← Changed from 'secondary'
    size = 'md',
    // ...
  }, ref) {
    // ...
  }
);

// IconTextButton.tsx
export const IconTextButton = forwardRef<HTMLButtonElement, IconTextButtonProps>(
  function IconTextButton({
    icon,
    iconPosition = 'left',
    variant = 'ghost', // ← Changed from 'secondary'
    size = 'md',
    // ...
  }, ref) {
    // ...
  }
);
```

## Consequences

### Positive
- ✅ **Cleaner UI** - Buttons blend into the interface naturally
- ✅ **Less visual noise** - No heavy gray backgrounds everywhere
- ✅ **Consistent defaults** - All buttons behave the same way
- ✅ **Explicit intent** - When you see `variant="primary"`, it means emphasis
- ✅ **Simpler code** - Most buttons don't need variant props at all
- ✅ **Better UX** - Users focus on content, not button chrome

### Visual Changes
- ⚠️ **Existing buttons will change** - All buttons without explicit variants will become ghost
- ✅ **This is intentional** - Ghost is the correct default for most cases
- 📋 **Action required:** If specific buttons need solid backgrounds, explicitly add `variant="default"` or `variant="primary"`

### Development Impact
- ✅ **Clearer patterns** - Ghost for subtle actions, Primary for emphasis
- ✅ **Less code** - Default buttons need no variant prop
- ✅ **Self-documenting** - Explicit variants signal importance

## Usage Guidelines

### When to Use Each Variant

**Ghost (default) - 80% of buttons:**
```tsx
<IconButton icon={<EditIcon />} aria-label="Edit" />
<TextButton onClick={handleCancel}>Cancel</TextButton>
<IconTextButton icon={<RefreshIcon />}>Refresh</IconTextButton>
```

**Primary - Main actions (15%):**
```tsx
<TextButton variant="primary" onClick={handleSave}>Save</TextButton>
<IconTextButton icon={<PlusIcon />} variant="primary">Create Variable</IconTextButton>
```

**Danger - Destructive actions (4%):**
```tsx
<IconButton icon={<TrashIcon />} variant="danger" aria-label="Delete" />
<TextButton variant="danger" onClick={handleDelete}>Delete All</TextButton>
```

**Default/Secondary - Rare (1%):**
```tsx
// Only when you need visible button boundaries
<TextButton variant="default">OK</TextButton>
```

## Alternatives Considered

### Alternative 1: Keep existing defaults
**Rejected** - Creates visual heaviness and requires constant `variant="ghost"` overrides

### Alternative 2: Different defaults per component
**Rejected** - Creates inconsistency and confusion

### Alternative 3: Remove ghost variant entirely
**Rejected** - Ghost buttons are essential for clean, minimal UIs

## Verification

Build command executed successfully:
```bash
npm run build
✓ built in 819ms
```

All TypeScript compilation passed with no errors.

## Migration Guide

### For Existing Code

**No action needed if:**
- Your buttons should be subtle/minimal (most cases)

**Action required if:**
- You need solid backgrounds → Add `variant="default"`
- You have important CTAs → Add `variant="primary"`
- You have destructive actions → Add `variant="danger"`

### Examples

**Before (automatic solid backgrounds):**
```tsx
<IconButton icon={<SettingsIcon />} aria-label="Settings" />
// Rendered with solid gray background
```

**After (automatic ghost):**
```tsx
<IconButton icon={<SettingsIcon />} aria-label="Settings" />
// Renders transparent with hover - usually what you want!

// If you specifically need solid:
<IconButton icon={<SettingsIcon />} variant="default" aria-label="Settings" />
```

## Related Files

**Modified:**
- `src/ui/components/common/IconButton/IconButton.tsx` - Changed default to ghost
- `src/ui/components/common/TextButton/TextButton.tsx` - Changed default to ghost
- `src/ui/components/common/IconTextButton/IconTextButton.tsx` - Changed default to ghost
- `src/ui/components/Toolbar/Toolbar.tsx` - Removed explicit `variant="default"` from add-collection-btn
- `specs/components.md` - Updated all button documentation

**Documentation:**
- Component usage examples updated with ghost-first pattern
- All three button components now clearly state default variant

**Cleanup:**
- Removed `variant="default"` from add-collection-btn (line 89) → now uses ghost default

## References

- User request: "Make ghost buttons default" (2025-03-23)
- Ghost variant styling: `bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200`
- Component inventory: [specs/components.md](../../specs/components.md)
- Tailwind CSS v4: [specs/styles.md](../../specs/styles.md)
