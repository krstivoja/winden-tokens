# Tokens Manager - Feature Roadmap

## Automation
- [ ] Deploy automation: https://github.com/typper-io/figma-plugin-deploy

---

## Features to Implement

### 1. Search & Filter ✅
**Quick win - instant value**

- [x] Add search input in toolbar
- [x] Filter table rows by name match
- [x] Show "X results" count

**Files:** main.ts, state.ts, index.html, _toolbar.scss

---

### 2. Duplicate Group
**Copy entire group with new prefix**

- [ ] Add "Duplicate" button to group header (next to delete)
- [ ] Prompt for new group name
- [ ] Copy all variables with new prefix

**Example:** `accent/` → `accent-alt/` (all 11 colors copied)

**Files:** table.ts, main.ts, code.ts

---

### 3. Multi-Edit / CSV Text Editor
**Edit many variables fast, paste from spreadsheets**

- [ ] Click "Edit as Text" on a group → opens modal
- [ ] Text area where each line = one variable
- [ ] Format: `name, value` (comma or tab separated)
- [ ] Parse and create/update variables on apply
- [ ] Show preview of changes before applying

**UI:**
```
┌─ Bulk Edit: accent (11 colors) ─────┐
│ ┌─────────────────────────────────┐ │
│ │ 50, #FFF5F7                     │ │
│ │ 100, #FFEAEF                    │ │
│ │ 200, #FFD5DF                    │ │
│ └─────────────────────────────────┘ │
│ [Preview] [Apply] [Cancel]          │
└─────────────────────────────────────┘
```

**Files:** New bulkedit.ts, _bulkedit.scss, index.html, code.ts

---

### 4. Contrast Checker
**Ensure accessibility compliance**

- [ ] New tab or modal for contrast checking
- [ ] Pick two colors (from tokens or custom)
- [ ] Show contrast ratio
- [ ] WCAG AA/AAA pass/fail badges
- [ ] Suggest adjustments for failing pairs

**UI:**
```
┌─ Contrast Checker ────────────┐
│ Foreground: [■ #000000] ▼     │
│ Background: [■ #FFFFFF] ▼     │
│                               │
│ Ratio: 21:1                   │
│ ✓ AA Normal  ✓ AA Large      │
│ ✓ AAA Normal ✓ AAA Large     │
└───────────────────────────────┘
```

**Files:** New contrast.ts, _contrast.scss, index.html

---

### 5. Multi-Mode Support (Light/Dark Themes)
**Largest feature - theme variants per token**

- [ ] Read modes from collection via Figma API
- [ ] Show mode tabs or columns in table
- [ ] Edit values per mode
- [ ] Add/rename/delete modes
- [ ] Copy value between modes

**Figma API:**
```typescript
collection.modes // [{modeId, name}, ...]
variable.valuesByMode[modeId]
variable.setValueForMode(modeId, value)
```

**Files:** code.ts, table.ts, state.ts, index.html

---

## Future Ideas

- [ ] Export to CSS Variables / Tailwind / JSON
- [ ] Import from JSON / CSS
- [ ] Token documentation (descriptions per token)
- [ ] Semantic token relationships (primitive → semantic → component)
- [ ] Color format toggle (HEX / RGB / HSL)
- [ ] Keyboard shortcuts (Cmd+N, Cmd+D, Cmd+F)
- [ ] Token usage tracking (find where tokens are used)
- [ ] Undo/redo history
