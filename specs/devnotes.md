# Development Notes

**How to compile, run, and develop the plugin**

---

## 🎯 Critical Rules

### 1. DRY (Don't Repeat Yourself)
**If code/markup is repeated more than 2 times, extract it into a component immediately.**

❌ **Bad:**
```tsx
<button className="btn btn-primary">Save</button>
<button className="btn btn-primary">Submit</button>
<button className="btn btn-primary">Confirm</button>
```

✅ **Good:**
```tsx
<Button variant="primary">Save</Button>
<Button variant="primary">Submit</Button>
<Button variant="primary">Confirm</Button>
```

### 2. Tailwind CSS Only
**Use ONLY Tailwind v4 utility classes. NO custom CSS files.**

See [styles.md](styles.md) for details.

### 3. Check Components First
**Always review [components.md](components.md) before creating new components.**

Search for existing components that do similar things. Reuse and extend rather than recreate.

### 4. Documentation Auto-Updates
**The @testing-dev agent automatically updates all specs after every change.**

You don't need to manually update documentation - it's handled by the agent teams.

---

## Quick Commands

```bash
# Development (Hot Reload)
npm run dev        # Dev server at http://localhost:5173 with auto-reload

# Build
npm run build      # Production build → dist/index.html + dist/code.js

# Testing
npm test           # Run all tests once
npm run test:watch # Run tests in watch mode
npm run test:ui    # Open Vitest UI

# Verification
npm run verify     # Build + Test (pre-commit check)
```

---

## Development Modes

### 1. Hot Reload Development (Recommended)

**Best for:** UI development, rapid iteration on components

```bash
npm run dev
```

**What happens:**
1. Vite dev server starts at `http://localhost:5173`
2. TypeScript watch compiles `code.ts` in background
3. Browser auto-reloads on file changes
4. Changes appear instantly (no manual refresh)

**How to use:**
1. Open browser to `http://localhost:5173`
2. Edit components in `src/ui/components/`
3. Save file
4. Browser automatically refreshes with changes

**Note:** This mode is for UI development only. To test actual Figma integration, use Build Mode below.

---

### 2. Build Mode (For Figma Plugin Testing)

**Best for:** Testing Figma plugin integration, final verification

```bash
npm run build
```

**What happens:**
1. Vite bundles UI → `dist/index.html` (single file with inline CSS/JS)
2. TypeScript compiles plugin → `dist/code.js`
3. Both files ready for Figma

**How to use in Figma:**
1. Run `npm run build`
2. Open Figma Desktop
3. Go to: **Plugins > Development > Import plugin from manifest**
4. Select this directory's `manifest.json`
5. Run the plugin
6. Make changes to code
7. Run `npm run build` again
8. Reload plugin in Figma (close and reopen)

---

### 3. Watch Mode (Continuous Build)

**Best for:** Iterating on plugin code while testing in Figma

```bash
npm run dev:build
```

**What happens:**
1. Vite watches and rebuilds UI on changes
2. TypeScript watches and recompiles `code.ts` on changes
3. Files automatically rebuild, but you must **manually reload** in Figma

**How to use:**
1. Run `npm run dev:build`
2. Load plugin in Figma
3. Edit code
4. Wait for build to complete (watch console)
5. **Manually reload plugin in Figma**

---

## Testing

### Running Tests

```bash
npm test              # Run once (for CI)
npm run test:watch    # Watch mode (for development)
npm run test:coverage # Coverage report
npm run test:ui       # Visual UI for test debugging
```

### Test Organization

Tests live **next to source files**:

```
src/ui/components/common/Button/
├── Button.tsx
├── Button.test.tsx      ← Test file
└── Button.stories.tsx   ← Storybook (optional)
```

### Coverage Goals

- **Components:** 80%+
- **Hooks:** 90%+
- **Utilities:** 95%+
- **Critical paths:** 100%

See [testing.md](testing.md) for patterns and examples.

---

## Build Output

### Production Build

```
dist/
├── index.html    # UI (HTML + inline CSS + inline JS)
└── code.js       # Plugin sandbox code
```

**Key:** Everything is bundled into `dist/index.html` as a single file for fast loading.

### Why Single File?

1. **Faster loading** - No additional network requests
2. **Simpler deployment** - One file to manage
3. **Figma requirement** - Plugins reference HTML files

---

## Development Workflow

### Typical Development Session

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Open browser:**
   ```
   http://localhost:5173
   ```

3. **Edit components:**
   ```
   src/ui/components/common/Button/Button.tsx
   ```

4. **Save → Browser auto-reloads**

5. **Write tests:**
   ```
   src/ui/components/common/Button/Button.test.tsx
   ```

6. **Run tests in watch mode:**
   ```bash
   npm run test:watch
   ```

7. **When ready for Figma testing:**
   ```bash
   npm run build
   ```

8. **Load in Figma and test**

---

## Debugging

### Browser DevTools

1. Open `http://localhost:5173`
2. Press `F12` or `Cmd+Opt+I`
3. Use React DevTools extension
4. Check console for errors
5. Inspect network requests

### Figma Plugin Console

1. Load plugin in Figma
2. Right-click in Figma
3. **Plugins > Development > Open Console**
4. See `console.log()` from `code.ts`

**Important:** Plugin console is SEPARATE from UI console.

- **UI console** = Browser DevTools (F12)
- **Plugin console** = Figma > Development > Open Console

---

## Common Issues

### Port Already in Use

**Error:** `Port 5173 is already in use`

**Fix:**
```bash
# Find and kill process using port 5173
lsof -ti:5173 | xargs kill -9

# Or use a different port
npm run dev -- --port 3000
```

### Build Fails

**Check:**
1. TypeScript errors: `npx tsc --noEmit`
2. Node version: `node --version` (should be 18+)
3. Clean install: `rm -rf node_modules && npm install`

### Tests Fail

**Check:**
1. Run single test: `npm test -- Button.test.tsx`
2. Update snapshots: `npm test -- -u`
3. Check imports and paths

### Plugin Won't Load in Figma

**Check:**
1. Did you run `npm run build`?
2. Does `dist/index.html` exist?
3. Does `dist/code.js` exist?
4. Is `manifest.json` valid? (check for syntax errors)
5. Try: **Plugins > Development > Clear Plugin Data**

---

## File Watching

Vite watches these files automatically:
- `src/**/*.tsx`
- `src/**/*.ts`
- `src/**/*.css`

**Not watched:**
- `manifest.json` (restart dev server)
- `package.json` (restart dev server)
- `.env` files (restart dev server)

---

## Environment Variables

Currently not used, but can be added via `.env`:

```bash
# .env.local
VITE_API_URL=https://api.example.com
```

Access in code:
```typescript
const apiUrl = import.meta.env.VITE_API_URL;
```

---

## TypeScript Configuration

### Two TypeScript Configs

1. **`tsconfig.json`** - UI code (React, DOM)
2. **`tsconfig.plugin.json`** - Plugin code (Figma API, no DOM)

**Why separate?**
- Plugin code runs in Figma sandbox (no DOM APIs)
- UI code runs in browser (no Figma APIs)
- Different type definitions needed

---

## Build Performance

### Current Build Times

- **Dev startup:** ~2s
- **Hot reload:** <1s
- **Production build:** ~5s
- **Test suite:** ~3s

### Optimization Tips

1. **Use dev mode** for UI work (instant reload)
2. **Use watch mode** if testing Figma integration
3. **Run tests in watch mode** (faster than full reruns)
4. **Only build when needed** (don't spam `npm run build`)

---

## Git Workflow

**Important:** Claude Code does NOT create commits unless explicitly asked.

Typical user workflow:
```bash
# Make changes
npm run verify     # Build + Test

# If all passes
git add .
git commit -m "Description"
git push
```

---

## Deployment Checklist

Before submitting to Figma Community:

- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] No console warnings in browser
- [ ] Plugin works in Figma Desktop
- [ ] Version updated in `manifest.json` and `package.json`
- [ ] Changelog updated in `docs/_posts/`

---

## Related Documentation

- [structure.md](structure.md) - File organization
- [components.md](components.md) - Component inventory
- [testing.md](testing.md) - Testing patterns
- [techstack.md](techstack.md) - Technologies used
