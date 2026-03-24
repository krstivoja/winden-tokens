# OptionsDropdown Unification

**Date:** 2025-03-24
**Status:** Accepted
**Decided by:** Orchestrator + User Request

## Context

The user identified visual inconsistencies between dropdowns in the application:

**User request:** "Those should have the same component that we use for the collections where we have the predefined button with the drop-down icon and then inside we put the options so can you unify the shade colors and the contrast to use that component and then when you click on it you get dropped down with the options to choose"

### Problem

Multiple dropdown patterns existed in the codebase:
1. **Collections/Mode/Types** - Used `OptionsDropdown` component (consistent ghost button + absolute positioned menu)
2. **Shades/Colors collection selector** - Custom implementation with manual state management, click-outside handling, and custom trigger styling
3. **Contrast pickers** - Similar custom implementation with manual state management

This violated the **DRY principle** and created **visual inconsistencies** where similar UI elements looked different.

### Screenshots Analysis

User provided screenshots showing:
- Collections dropdown: Clean IconTextButton with ChevronDown icon
- Shades/colors dropdown: Custom styled trigger with different appearance
- Contrast dropdown: IconTextButton (already fixed in previous iteration)
- Types dropdown: Clean IconTextButton

**Issue:** Shades/colors selector didn't match the visual pattern of other dropdowns.

## Decision

**Unify all table column dropdowns to use the OptionsDropdown component.**

### Implementation

**1. GroupCollectionCell.tsx** - Replaced custom dropdown with OptionsDropdown
```tsx
// Before
const [isOpen, setIsOpen] = useState(false);
const dropdownRef = useRef<HTMLDivElement>(null);

// Manual click-outside handling
useEffect(() => {
  if (!isOpen) return;
  function handleClickOutside(event: MouseEvent) {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  }
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [isOpen]);

return (
  <div className="collection-cell relative" ref={dropdownRef}>
    <div
      className="collection-cell-trigger"
      onClick={(e) => {
        e.stopPropagation();
        setIsOpen(!isOpen);
      }}
      title="Move group to collection"
    >
      <span className="collection-label">{buttonLabel}</span>
      <span className="dropdown-arrow"><ChevronDownIcon /></span>
    </div>

    {isOpen && (
      <div className="collection-cell-dropdown">
        <div className="dropdown-list">
          {collections.map(collection => (
            <Radio ... />
          ))}
        </div>
      </div>
    )}
  </div>
);

// After
return (
  <div className="collection-cell">
    <OptionsDropdown label={buttonLabel}>
      {collections.map(collection => (
        <Radio
          key={collection.id}
          className="dropdown-item"
          name="group-collection-cell"
          label={collection.name}
          checked={currentCollectionId === collection.id}
          onChange={() => handleMoveGroupToCollection(collection.id)}
        />
      ))}
    </OptionsDropdown>
  </div>
);
```

**Key Changes:**
- Removed `useState`, `useRef`, `useEffect` imports (not needed)
- Removed 30+ lines of manual dropdown state/positioning/click-outside logic
- Removed custom CSS classes (`.collection-cell-trigger`, `.collection-cell-dropdown`)
- Replaced with simple `<OptionsDropdown>` wrapper

**2. CollectionCell.tsx** - Same refactoring pattern
- Removed manual state management
- Removed click-outside handling
- Replaced custom trigger with OptionsDropdown
- Simplified from ~85 lines to ~54 lines

## Consequences

### Positive

✅ **Visual Consistency**
- All dropdowns now use the same IconTextButton trigger
- Same ghost variant styling: `bg-transparent text-gray-700 hover:bg-gray-100`
- Same ChevronDown icon positioned on the right
- Same absolute positioned menu with shadow and border

✅ **Code Simplification**
- **GroupCollectionCell.tsx**: Removed ~30 lines of boilerplate
- **CollectionCell.tsx**: Removed ~30 lines of boilerplate
- Total: ~60 lines removed
- Eliminated duplicate dropdown logic in 2 components

✅ **DRY Principle Enforced**
- One reusable OptionsDropdown component
- Single source of truth for dropdown behavior
- Consistent click-outside handling
- Consistent keyboard interactions (Escape to close)

✅ **Accessibility**
- All dropdowns now have `aria-expanded` and `aria-haspopup="menu"` attributes
- Consistent keyboard support from OptionsDropdown

✅ **Maintainability**
- Easier to update dropdown styling globally
- Easier to add new dropdown features (search, sections, etc.)
- Less code to test and maintain

### Technical Details

**OptionsDropdown Features** (now used everywhere):
- Ghost variant button by default
- ChevronDown icon on the right
- Absolute positioned menu (`top-full left-0 mt-1`)
- z-index 50 (overlays content, doesn't push)
- Click-outside to close
- Escape key to close
- Min-width 200px
- Padding and border-radius consistent
- Shadow-lg for depth

**Pattern Comparison:**

| Component | Before | After |
|-----------|--------|-------|
| CollectionFilters | ✅ OptionsDropdown | ✅ OptionsDropdown |
| VariableTypeFilters | ✅ OptionsDropdown | ✅ OptionsDropdown |
| ModeSelector | ✅ OptionsDropdown | ✅ OptionsDropdown |
| GroupCollectionCell | ❌ Custom | ✅ OptionsDropdown |
| CollectionCell | ❌ Custom | ✅ OptionsDropdown |
| GroupHeader Contrast | ❌ Custom div trigger + manual | ✅ OptionsDropdown |
| TableRow Contrast | ❌ Custom div trigger + manual | ✅ OptionsDropdown |

## Files Modified

### GroupCollectionCell.tsx
- **Lines removed:** ~30 (state management, effects, refs)
- **Imports changed:**
  - Removed: `useState`, `useRef`, `useEffect`, `ChevronDownIcon`
  - Added: `OptionsDropdown`
- **Simplified:** 93 lines → 59 lines

### CollectionCell.tsx
- **Lines removed:** ~30 (state management, effects, refs)
- **Imports changed:**
  - Removed: `useState`, `useRef`, `useEffect`, `ChevronDownIcon`
  - Added: `OptionsDropdown`
- **Simplified:** 85 lines → 54 lines

### GroupHeader.tsx (2nd iteration)
- **Lines removed:** ~25 (state management, effects, refs, manual click handling)
- **Imports changed:**
  - Removed: `useState`, `ChevronDownIcon`
  - Added: `IconTextButton`, `OptionsDropdown`
- **Replaced:** Custom div trigger + manual dropdown → OptionsDropdown wrapper
- **Simplified contrast logic:** Removed `showContrastPicker` state, `handleContrastClick`, `useEffect` for click-outside

### TableRow.tsx (2nd iteration)
- **Lines removed:** ~30 (state management, effects, refs, manual click handling)
- **Imports changed:**
  - Removed: `useEffect`
  - Added: `OptionsDropdown`
- **Replaced:** Two custom div triggers + manual dropdowns → Two OptionsDropdown wrappers
- **Simplified contrast logic:** Removed `showContrastPicker` state, `handleContrastClick`, `useEffect` for click-outside

## Verification

Build command executed successfully:
```bash
npm run build
✓ built in 838ms
```

All TypeScript compilation passed with no errors.

## Visual Changes

**Before:**
- Shades/colors selector: Custom styled button with different hover states
- Inconsistent spacing and padding
- Different chevron icon positioning
- Custom dropdown positioning logic (could vary)

**After:**
- All dropdowns look identical
- Same ghost hover animation
- Same chevron icon on right
- Same absolute positioned menu
- Consistent spacing throughout

## Related Decisions

- [2025-03-23 Ghost-First Button Strategy](./2025-03-23-ghost-first-button-strategy.md)
- [2025-03-23 Absolute Dropdown Positioning](./2025-03-23-absolute-dropdown-positioning.md)
- [2025-03-23 Eliminate Raw Button Elements](./2025-03-23-eliminate-raw-button-elements.md)

## Future Considerations

### Potential Enhancements to OptionsDropdown

1. **Search capability** - Filter long lists of options
2. **Sections/Groups** - Divide options into categories
3. **Icons in options** - Support leading icons for each option
4. **Multi-select mode** - Checkbox groups instead of radio
5. **Position variants** - Support right-aligned or top-positioned menus
6. **Loading states** - Show spinner while fetching options
7. **Empty states** - Custom message when no options available

All of these could be added to OptionsDropdown once, benefiting all dropdowns in the app.

## Component Reuse Benefits

By using OptionsDropdown everywhere, we get:

1. **Instant bug fixes** - Fix once, applies to all dropdowns
2. **Feature propagation** - Add feature once, all dropdowns get it
3. **Performance optimization** - Optimize once, all benefit
4. **Design consistency** - Change styling once, all update
5. **Testing efficiency** - Test OptionsDropdown thoroughly once

## References

- User request: "unify the shade colors and the contrast to use that component" (2025-03-24)
- DRY principle: [specs/devnotes.md](../../specs/devnotes.md)
- Component guidelines: [specs/components.md](../../specs/components.md)
- OptionsDropdown implementation: [src/ui/components/common/OptionsDropdown/OptionsDropdown.tsx](../../src/ui/components/common/OptionsDropdown/OptionsDropdown.tsx)
