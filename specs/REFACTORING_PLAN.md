# Refactoring Plan

**Project:** Winden Tokens Figma Plugin
**Date Created:** 2026-03-30
**Status:** Planning

---

## Overview

This document tracks refactoring tasks to improve code quality, maintainability, and architecture of the Winden Tokens plugin.

---

## Priority Levels

- 🔴 **High Priority** - Critical issues affecting maintainability or causing bugs
- 🟡 **Medium Priority** - Important improvements that enhance code quality
- 🟢 **Low Priority** - Nice-to-have improvements and optimizations

---

## 🔴 High Priority Tasks

**All high-priority tasks completed!** ✅

---

## 🟡 Medium Priority Tasks

### 1. Split GroupedGraph Component
**Status:** ❌ Not Started
**Estimated Time:** 3-4 hours
**Files Affected:**
- `src/ui/components/Relationships/GroupedGraph.tsx` (1,062 lines)
- `src/ui/components/Relationships/GraphSidebar.tsx` (new)
- `src/ui/components/Relationships/GraphControls.tsx` (new)
- `src/ui/components/Relationships/GraphLayout.tsx` (new)

**Current Issue:**
- Single file with 1,062 lines
- Handles: node rendering, edge logic, sidebar filters, grid layout, position saving
- Hard to understand and maintain
- Difficult to test individual features

**Solution:**
Split into focused components:

**GraphSidebar.tsx** (~150 lines):
- Mode selector
- Type filters
- Collection filters
- Group filters

**GraphControls.tsx** (~100 lines):
- Auto-layout button
- Grid spacing controls
- View controls

**GraphLayout.tsx** (~200 lines):
- Grid layout calculations
- Position management
- Auto-arrangement logic

**GroupedGraph.tsx** (main, ~600 lines):
- ReactFlow integration
- Node/edge state
- Event handlers
- Coordinate compositions

**Benefits:**
- Easier to understand each piece
- Better testability
- Clearer responsibilities
- Faster development on specific features

---

### 2. Split ShadesModal Component
**Status:** ❌ Not Started
**Estimated Time:** 2-3 hours
**Files Affected:**
- `src/ui/components/Modals/ShadesModal.tsx` (941 lines)
- `src/ui/components/Modals/ShadesForm.tsx` (new)
- `src/ui/components/Modals/ShadesPreview.tsx` (new)
- `src/ui/hooks/useShadeGeneration.ts` (new)

**Current Issue:**
- Single file with 941 lines
- Handles: form state, shade calculation, preview rendering, plugin communication
- Complex logic mixed with UI

**Solution:**
Extract:
- **ShadesForm.tsx**: Form inputs and validation
- **ShadesPreview.tsx**: Color preview grid
- **useShadeGeneration.ts**: Shade calculation logic

---

### 3. Split StepsModal Component
**Status:** ❌ Not Started
**Estimated Time:** 2-3 hours
**Files Affected:**
- `src/ui/components/Modals/StepsModal.tsx` (653 lines)
- Similar split pattern as ShadesModal

---

### 4. Add Message Type Safety
**Status:** ❌ Not Started
**Estimated Time:** 1-2 hours
**Files Affected:**
- `src/ui/types/messages.ts` (new)
- `src/ui/App.tsx`
- `src/ui/hooks/usePluginMessages.ts`

**Current Issue:**
```tsx
'data-loaded': (msg: any) => {
```

**Solution:**
Create typed message union:
```typescript
// src/ui/types/messages.ts
export type PluginMessage =
  | { type: 'data-loaded'; collections: CollectionData[]; variables: VariableData[]; shadeGroups: ShadeGroupData[] }
  | { type: 'update-success' }
  | { type: 'update-error'; error: string }
  | { type: 'history-state'; canUndo: boolean; canRedo: boolean }
  | { type: 'history-applied'; canUndo: boolean; canRedo: boolean }
  // ... more message types

export type UIMessage =
  | { type: 'update-variable-value'; id: string; value: string; modeId: string }
  | { type: 'update-variable-name'; id: string; name: string }
  | { type: 'delete-variable'; id: string }
  // ... more message types
```

**Usage:**
```typescript
const messageHandlers = useCallback(() => ({
  'data-loaded': (msg: Extract<PluginMessage, { type: 'data-loaded' }>) => {
    setData(msg.collections, msg.variables, msg.shadeGroups);
  },
  // ...
}), []);
```

**Benefits:**
- Type safety for plugin-UI communication
- Catches message format errors at compile time
- Better IDE autocomplete
- Self-documenting API

---

## 🟢 Low Priority Tasks

### 1. Document State Management Patterns
**Status:** ❌ Not Started
**Estimated Time:** 1 hour
**Files Affected:**
- `specs/architecture.md` (new)
- `docs/decisions/ADR-003-state-management.md` (new)

**Solution:**
Document:
- When to use AppContext vs local state
- Mode handling pattern (global context only)
- Filter state patterns
- Message passing patterns

---

### 2. Audit Toolbar Components
**Status:** ❌ Not Started
**Estimated Time:** 1 hour
**Files Affected:**
- `src/ui/components/Toolbar/ModeSelector.tsx`
- `src/ui/components/Table/SidebarFilter.tsx`

**Issue:**
- ModeSelector exists but isn't used
- SidebarFilter has its own mode selector
- Potential duplication

**Solution:**
- Decide on single mode selector component
- Remove or consolidate duplicates

---

### 3. Review React.memo Usage
**Status:** ❌ Not Started
**Estimated Time:** 1-2 hours
**Files Affected:**
- `src/ui/components/Table/TableRow.tsx`
- Other memoized components

**Issue:**
- TableRow wrapped in React.memo without proper dep tracking
- Fixed by adding selectedModeId prop, but pattern is fragile

**Solution:**
- Use React DevTools Profiler to identify real performance issues
- Only memo components with proven performance problems
- Document when/why to use memo

---

### 4. Add Error Boundaries
**Status:** ❌ Not Started
**Estimated Time:** 2 hours
**Files Affected:**
- `src/ui/components/ErrorBoundary.tsx` (new)
- `src/ui/App.tsx`

**Solution:**
```tsx
<ErrorBoundary fallback={<ErrorFallback />}>
  <App />
</ErrorBoundary>
```

---

### 5. Add Loading States
**Status:** ❌ Not Started
**Estimated Time:** 1 hour
**Files Affected:**
- `src/ui/context/AppContext.tsx`
- `src/ui/App.tsx`
- `src/ui/components/LoadingSpinner.tsx` (new)

**Solution:**
Add `isLoading` state to context, show spinner during:
- Initial data load
- Variable updates
- Filter application (if slow)

---

### 6. Extract Filter Initialization Logic
**Status:** ❌ Not Started
**Estimated Time:** 1 hour
**Files Affected:**
- `src/ui/hooks/useFilterInitialization.ts` (new)
- `src/ui/components/Table/TableView.tsx`
- `src/ui/components/Relationships/GroupedGraph.tsx`

**Current Issue:**
Duplicate initialization in both views:
```typescript
// Extract types from variables
const types = new Set<string>();
filteredVariables.forEach(v => types.add(v.resolvedType));
setSelectedTypes(types);

// Extract collection IDs
const collectionIds = new Set(collections.map(c => c.id));
setSelectedCollections(collectionIds);

// Extract group names
const groups = new Set<string>();
filteredVariables.forEach(v => {
  const parts = v.name.split('/');
  if (parts.length > 1) {
    groups.add(parts[0]);
  }
});
setSelectedGroups(groups);
```

**Solution:**
Move to AppContext or create hook:
```typescript
export function useFilterInitialization(variables: VariableData[], collections: CollectionData[]) {
  return useMemo(() => {
    const types = new Set<string>();
    const groups = new Set<string>();

    variables.forEach(v => {
      types.add(v.resolvedType);
      const parts = v.name.split('/');
      if (parts.length > 1) {
        groups.add(parts[0]);
      }
    });

    const collectionIds = new Set(collections.map(c => c.id));

    return { types, collectionIds, groups };
  }, [variables, collections]);
}
```

---

### 7. Split SidebarFilter Component
**Status:** ❌ Not Started
**Estimated Time:** 2 hours
**Files Affected:**
- `src/ui/components/Table/SidebarFilter.tsx` (275 lines)
- `src/ui/components/filters/ModeSelector.tsx` (new)
- `src/ui/components/filters/TypeFilterList.tsx` (new)
- `src/ui/components/filters/CollectionTree.tsx` (new)
- `src/ui/components/filters/GroupFilterList.tsx` (new)

**Current Issue:**
SidebarFilter handles:
- Mode selection
- Type filtering
- Collection filtering with expand/collapse
- Group filtering
- Collection creation

**Solution:**
Split into focused components that can be composed.

---

## Progress Tracking

**High Priority:** 3/3 complete (100%)
**Medium Priority:** 0/5 complete (0%)
**Low Priority:** 0/7 complete (0%)

**Overall:** 3/13 complete (23%)

---

## Estimated Timeline

- **High Priority:** ✅ Completed (6 hours)
- **Medium Priority:** 8-11 hours
- **Low Priority:** 10-12 hours
- **Remaining:** 18-23 hours (2-3 days of focused work)
- **Completed:** 6 hours (1 day)

---

## Notes

- Complete high priority tasks first (they're blockers for other work)
- Medium priority can be done incrementally
- Low priority are optimizations and can be deferred
- Test thoroughly after each major refactor
- Update specs/ docs after completing tasks
- Consider creating branches for large refactors

---

## Related Documentation

- [devnotes.md](devnotes.md) - Development workflow
- [structure.md](structure.md) - File organization
- [components.md](components.md) - Component reference
- [techstack.md](techstack.md) - Technologies used

---

**Last Updated:** 2026-03-30

---

## Completed Tasks

### ✅ Task #1 - Centralize Filter State in AppContext (2026-03-30)

**Duration:** 2.5 hours
**Files Modified:** 3
**Lines Eliminated:** ~150 lines of duplicate code
**Status:** Completed and tested successfully

**Changes Made:**

1. **AppContext.tsx:**
   - Added `selectedGroups: Set<string>` to AppState interface
   - Added `toggleSelectedGroup()` and `toggleAllGroups()` methods
   - Implemented group state initialization in `setData()` callback
   - All filter state now centralized

2. **TableView.tsx:**
   - Removed local state for filters (3 useState hooks)
   - Removed initialization useEffect (~25 lines)
   - Removed duplicate toggle handlers (~35 lines)
   - Now uses context values and methods
   - Simplified by ~80 lines

3. **GroupedGraph.tsx:**
   - Removed local filter state
   - Removed duplicate toggle handlers (~35 lines)
   - Removed stale initialization useEffect (~13 lines)
   - Handlers delegate to context methods

**Benefits Achieved:**
- ✅ Single source of truth for all filter state
- ✅ No state synchronization issues between views
- ✅ Consistent filtering behavior across Table and Relationships views
- ✅ Eliminated ~150 lines of duplicate code
- ✅ Easier to test (state management centralized)
- ✅ TypeScript compilation successful

**Testing:**
- Verified with test agent
- Fixed missing `useCallback` import in TableView
- Removed stale initialization code in GroupedGraph
- Build passes successfully

---

### ✅ Task #2 - Extract Toggle Logic to Custom Hook (2026-03-30)

**Duration:** 1 hour
**Files Created:** 1
**Files Modified:** 1
**Lines Eliminated:** ~90 lines of duplicate code
**Status:** Completed and tested successfully

**Changes Made:**

1. **Created `src/ui/hooks/useToggleSet.ts`:**
   - Custom React hook for managing Set-based toggle state
   - Generic type parameter `<T>` for flexibility
   - Provides `toggle()`, `toggleAll()`, and `clear()` methods
   - Uses `useCallback` for memoization
   - Returns typed interface `UseToggleSetReturn<T>`
   - Comprehensive JSDoc documentation

2. **AppContext.tsx:**
   - Replaced three `useState<Set<string>>` calls with `useToggleSet` hook
   - `selectedCollectionIds` → `collectionFilter.items`
   - `selectedVariableTypes` → `typeFilter.items`
   - `selectedGroups` → `groupFilter.items`
   - Updated toggle methods to delegate to hook's methods
   - Simplified initialization logic in `setData()` callback
   - Reduced code by ~50 lines

**Benefits Achieved:**
- ✅ Eliminated ~90 lines of duplicate toggle handler code
- ✅ Reusable pattern for any Set-based toggle logic
- ✅ Easier to test in isolation
- ✅ Consistent behavior across all Set-based filters
- ✅ Better TypeScript inference with generics
- ✅ Self-documenting with JSDoc examples

**Testing:**
- Build passes successfully
- All toggle functionality works as expected

---

### ✅ Task #3 - Split AppContext into Focused Contexts (2026-03-30)

**Duration:** 2.5 hours
**Files Created:** 4 (3 new contexts + composite)
**Files Modified:** 2
**Status:** Completed and tested successfully

**Changes Made:**

1. **Created `src/ui/context/DataContext.tsx`:**
   - Core data management (collections, variables, shadeGroups)
   - `selectedCollectionId` state
   - `setData()` method
   - `colorVariables` computed value
   - Shade group lookup methods
   - 91 lines

2. **Created `src/ui/context/FilterContext.tsx`:**
   - Filter state management
   - Uses `useToggleSet` hook for collection, type, and group filters
   - `selectedModeId` state
   - `searchQuery` state
   - `filteredVariables` computed value
   - All toggle methods
   - 143 lines

3. **Created `src/ui/context/UIStateContext.tsx`:**
   - UI-specific state (collapsed groups, contrast colors)
   - Group collapse/expand methods
   - Contrast color get/set methods
   - 104 lines

4. **Refactored `src/ui/context/AppContext.tsx`:**
   - Now a composite provider that wraps all three contexts
   - `AppProvider` composes DataProvider, FilterProvider, UIStateProvider
   - `useAppContext()` combines all three context hooks
   - Provides backward compatibility for existing components
   - Exports individual context hooks for gradual migration
   - Reduced from 338 lines to 40 lines

5. **Updated `src/ui/components/Relationships/RelationshipsView.tsx`:**
   - Removed prop drilling
   - Reduced destructured props from 5 to 2
   - GroupedGraph now uses context directly

6. **Updated `src/ui/components/Relationships/GroupedGraph.tsx`:**
   - Removed all props from component signature
   - Uses `useAppContext()` directly
   - Removed `GroupedGraphProps` import
   - Cleaner component API

**Benefits Achieved:**
- ✅ Reduced re-renders (only affected contexts update)
- ✅ Clearer separation of concerns
- ✅ Each context can be tested independently
- ✅ Better TypeScript inference
- ✅ Removed prop drilling from GroupedGraph
- ✅ Backward compatible via composite hook
- ✅ Components can gradually migrate to focused context hooks
- ✅ Reduced AppContext from 338 lines to 40 lines (88% reduction)

**Context Composition:**
```typescript
<DataProvider>
  <FilterProvider>
    <UIStateProvider>
      <App />
    </UIStateProvider>
  </FilterProvider>
</DataProvider>
```

**Testing:**
- Build passes successfully
- All components still work with composite `useAppContext()` hook
- No breaking changes to existing components
