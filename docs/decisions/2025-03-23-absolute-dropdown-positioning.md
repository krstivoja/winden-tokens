# Absolute Dropdown Positioning

**Date:** 2025-03-23
**Status:** Accepted
**Decided by:** Orchestrator + User Request

## Context

The `OptionsDropdown` component was using default (static) positioning, which caused the dropdown menu to push content down when opened instead of overlaying it as an absolute positioned element.

**Issue:** When dropdowns like "Types (4/4)" or "Collections (1/1)" were opened, they shifted the content below them downward, creating a poor user experience.

**User request:** "on click dropdown needs to be absolute"

## Decision

Update `OptionsDropdown` to use **absolute positioning** for the dropdown menu.

### Implementation

**Parent container:** Changed from `.options-dropdown` to use Tailwind's `relative` class:
```tsx
<div className={`relative ${className}`.trim()} ref={dropdownRef}>
```

**Dropdown menu:** Changed to use absolute positioning with proper styling:
```tsx
<div className="absolute top-full left-0 mt-1 bg-white border border-border rounded shadow-lg z-50 min-w-[200px] p-2">
  {children}
</div>
```

### Styling Details

**Positioning:**
- `absolute` - Removes from document flow, overlays content
- `top-full` - Positions menu directly below the trigger button
- `left-0` - Aligns menu with left edge of trigger
- `mt-1` - 4px gap between trigger and menu

**Visual styling:**
- `bg-white` - White background
- `border border-border` - Subtle border using theme color
- `rounded` - Rounded corners
- `shadow-lg` - Elevation shadow for depth
- `p-2` - Padding inside menu

**Layout:**
- `z-50` - High z-index ensures menu appears above other content
- `min-w-[200px]` - Minimum width for readability

## Consequences

### Positive
- ✅ **Better UX** - Content doesn't jump when dropdown opens
- ✅ **Overlay behavior** - Dropdown floats above content like standard dropdowns
- ✅ **Proper layering** - z-50 ensures dropdown appears above table and other UI
- ✅ **Consistent spacing** - 4px gap (mt-1) between trigger and menu
- ✅ **Professional appearance** - Shadow and border create depth

### Visual Changes
- ⚠️ **Dropdown now overlays** - Previously pushed content, now overlays it
- ✅ **This is the expected behavior** - Matches standard dropdown UX patterns

### Technical Impact
- ✅ **No breaking changes** - Component API remains the same
- ✅ **Better accessibility** - Menu appears immediately below trigger
- ✅ **Self-contained** - Parent needs `relative`, menu uses `absolute`

## Usage

No changes required for existing usages. The component automatically handles positioning:

```tsx
// Works the same as before, but now overlays content
<OptionsDropdown label="Collections (1/1)">
  <Checkbox label="Collection 1" />
  <Checkbox label="Collection 2" />
</OptionsDropdown>
```

## Edge Cases Handled

**Click outside:** Menu closes when clicking anywhere outside the dropdown
**Escape key:** Menu closes when pressing Escape
**Z-index conflicts:** `z-50` is high enough to appear above most content
**Responsive:** `min-w-[200px]` ensures menu is always readable

## Related Files

**Modified:**
- `src/ui/components/common/OptionsDropdown/OptionsDropdown.tsx` - Added absolute positioning
- `specs/components.md` - Updated OptionsDropdown documentation

**Components using OptionsDropdown:**
- `CollectionFilters.tsx` - "Collections (1/1)" dropdown
- `ModeSelector.tsx` - "Mode 1" dropdown
- `VariableTypeFilters.tsx` - "Types (4/4)" dropdown

All benefit from the improved positioning automatically.

## Verification

Build command executed successfully:
```bash
npm run build
✓ built in 830ms
```

All TypeScript compilation passed with no errors.

## References

- User request: "on click dropdown needs to be absolute" (2025-03-23)
- Component: [OptionsDropdown.tsx](../../src/ui/components/common/OptionsDropdown/OptionsDropdown.tsx)
- Documentation: [specs/components.md](../../specs/components.md)
