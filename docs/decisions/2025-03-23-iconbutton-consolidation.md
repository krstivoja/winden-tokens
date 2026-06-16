# IconButton Component Consolidation

**Date:** 2025-03-23
**Status:** Accepted
**Decided by:** Orchestrator + Functionality Developer

## Context

During a component audit to ensure DRY (Don't Repeat Yourself) principles, we discovered two separate implementations of the IconButton component:

1. **`src/ui/components/common/IconButton.tsx`** (46 lines)
   - No `forwardRef` support
   - No `size` prop
   - Minimal styling (transparent background)
   - Basic functionality only

2. **`src/ui/components/common/IconButton/IconButton.tsx`** (61 lines)
   - Full `forwardRef` support
   - `size` prop with sm/md/lg variants
   - Proper button styling with backgrounds
   - Better accessibility (aria-hidden on icon wrapper)

This duplication violated our core DRY principle and created confusion about which component to use.

## Decision

**Consolidate to a single IconButton implementation:**
- ✅ Keep: `src/ui/components/common/IconButton/IconButton.tsx` (the better, feature-complete version)
- ❌ Delete: `src/ui/components/common/IconButton.tsx` (the outdated, minimal version)
- 🔧 Update all imports across the codebase

## Implementation

Updated imports in the following files:
- `src/ui/components/Table/GroupHeader.tsx`
- `src/ui/components/Tabs/TabBar.tsx`
- `src/ui/components/common/Modal/Modal.tsx`
- `src/ui/components/common/Button/Button.tsx` (re-exports)

All imports now reference: `'../common/IconButton/IconButton'`

## Consequences

### Positive
- ✅ **Single source of truth** - One consistent IconButton implementation
- ✅ **Better features** - All components now get `forwardRef` and `size` support
- ✅ **Improved accessibility** - Proper aria-hidden wrapper on icons
- ✅ **Follows DRY principle** - No duplicate component code
- ✅ **Clearer API** - Developers know exactly which component to use
- ✅ **Build verified** - All changes compile successfully

### Potential Issues
- ⚠️ **Visual changes possible** - The consolidated version has styled backgrounds (not transparent)
  - Components using IconButton may see slight visual differences
  - This is actually an improvement (proper button appearance)

### Maintenance
- 📋 **Future components** should always import from `IconButton/IconButton.tsx`
- 📋 **Documentation updated** in specs/components.md to reflect single source
- 📋 **No migration needed** - All existing usages now use the better implementation

## Alternatives Considered

### Alternative 1: Keep both versions
**Rejected** - Violates DRY principle and creates confusion

### Alternative 2: Keep the simpler version
**Rejected** - Would lose valuable features (forwardRef, size variants, better styling)

### Alternative 3: Create a new unified version
**Rejected** - The folder-based version already has all needed features

## Verification

Build command executed successfully:
```bash
npm run build
✓ built in 863ms
```

All TypeScript compilation passed with no errors.

## Related Files

**Modified:**
- `src/ui/components/Table/GroupHeader.tsx`
- `src/ui/components/Tabs/TabBar.tsx`
- `src/ui/components/common/Modal/Modal.tsx`
- `src/ui/components/common/Button/Button.tsx`

**Deleted:**
- `src/ui/components/common/IconButton.tsx`

**Preserved:**
- `src/ui/components/common/IconButton/IconButton.tsx` (canonical version)
- `src/ui/components/common/IconButton/IconButton.test.tsx`
- `src/ui/components/common/IconButton/IconButton.stories.tsx`

## References

- Component audit report (2025-03-23)
- DRY principle: [specs/devnotes.md](../../specs/devnotes.md)
- Component inventory: [specs/components.md](../../specs/components.md)
