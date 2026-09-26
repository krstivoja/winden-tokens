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

# Browser bridge (run the UI full-size in a browser tab)
winden-tokens      # published CLI: relay + prebuilt UI, no repo and no vite needed
npm run dev:bridge # this repo, while developing the UI itself
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

### 4. Browser Bridge (Run the UI in a Browser Tab)

**Best for:** the Relationships graph, which is cramped inside the Figma plugin iframe.

The same UI runs full-size in a browser tab, driving the Figma file that is currently open.
A small local relay pairs the Figma plugin window with the tab and forwards messages between them; it holds no state of its own.
See [../plans/browser-bridge.md](../plans/browser-bridge.md) for the design and the threat model, and `bridge/server.mjs` for the protocol.

#### Just using it — no repo, no vite

```bash
npm install -g winden-tokens
winden-tokens
```

That one command starts the relay AND serves the prebuilt UI from the same origin, then opens a browser at it.
Then open the Winden Tokens plugin in Figma on the file you want, and leave that window open: it is the only thing that can talk to the Figma API.
The plugin window collapses to a status strip while the tab has the wheel.

```
winden-tokens --port <n>   relay and UI on another port (see the caveat below)
winden-tokens --no-open    do not open a browser
winden-tokens --dev        also accept a client from the vite dev server
winden-tokens --help       the above, with the caveats
```

**`--port` is not a free choice.**
The Figma plugin can only open a socket to a host its `manifest.json` lists, and the manifest lists `ws://localhost:9337`.
Moving the relay also means changing the manifest and rebuilding the plugin, so `--port` only helps someone who can do both.

#### Developing the UI itself

```bash
npm run dev:bridge
```

This runs the relay in dev mode alongside vite, and is the **only** thing that still needs vite.
Dev mode is what puts the vite origin (`http://localhost:5173`) on the relay's Origin allowlist; a published `winden-tokens` never has it.
Open `http://localhost:5173`, not the relay's own port, and you get hot reload against the live Figma file.

For testing the bridge inside Figma you need a bridge-enabled plugin bundle, which a plain build deliberately does not produce:

```bash
VITE_BRIDGE=1 npm run build   # dist/index.html WITH the bridge client
npm run build                 # dist/index.html with NO bridge code at all
```

A plain production build must always satisfy `grep -c WebSocket dist/index.html` → `0`.
If you have been testing the bridge in Figma, remember that `dist/index.html` is tracked: do not commit a `VITE_BRIDGE=1` bundle.

#### Do not widen the Origin allowlist

A WebSocket handshake is not subject to CORS.
The relay's Origin check is the only thing standing between a page the user happens to have open and write commands into their Figma file.
The relay binds `127.0.0.1` only, accepts `role: 'client'` only from the page it served itself (plus the vite origin in `--dev`), and accepts `role: 'plugin'` only from a null Origin, which is what the sandboxed Figma iframe sends.
Read the THREAT MODEL block at the top of `bridge/server.mjs` before changing any of it.

---

---

### 5. MCP Server (manage tokens from Claude)

**Best for:** reading and editing the token structure from a chat, without a browser tab.

`winden-tokens-mcp` is a second bin in the same `winden-tokens` package.
It is a third peer on the same relay: it may send plugin commands and receives everything the plugin broadcasts, and it can never impersonate the plugin.
See [../plans/mcp-server.md](../plans/mcp-server.md) for the design, and the PROTOCOL (2b) block in `bridge/server.mjs` for the role.

#### The one-line client config

```bash
claude mcp add winden-tokens -- winden-tokens-mcp
```

Claude Desktop wants the same thing as JSON, in `claude_desktop_config.json`:

```json
{ "mcpServers": { "winden-tokens": { "command": "winden-tokens-mcp" } } }
```

Add `"args": ["--port", "9338"]` only if the relay is on another port.

#### Both halves must already be running

```bash
npm install -g winden-tokens
winden-tokens --no-open        # 1. the relay
                               # 2. open the Winden Tokens plugin in Figma, leave the window open
```

The MCP server starts nothing.
If the relay is not listening, or no Figma plugin is attached to it, it **refuses to start** and says which of the two is missing rather than hanging on the first tool call.
Start them, then reconnect the MCP server in your client.

#### Tools

| | |
|---|---|
| `list_collections` | collections, their modes, variable counts, the groups inside them |
| `list_variables` | filter by collection, group prefix, type or name substring |
| `get_variable` | value per mode, what it references per mode, what references it |
| `create_collection`, `create_variable`, `create_group` | additive |
| `set_variable_value` | per mode; a raw value or `{another/variable}` |
| `rename_variable`, `delete_variable` | **destructive, no undo from the model's side** |

`rename_variable` and `delete_variable` say so at the top of their own descriptions, so a client that can gate tools has something to gate on.
Figma's own undo, in the Figma window, is the only way back from either.

Deliberately not in v1: binding a variable to a node property (it depends on the live Figma selection, which the model cannot see) and `rename-group` (it silently rewires every consumer).

#### How request/response works over a broadcast protocol

The plugin protocol is fire-and-forget: commands carry no id, replies carry no id, and every reply goes to everything attached.
So the MCP server correlates by outcome — reads await the next `data-loaded`, writes await the next `update-success` / `update-error` — and every wait is bounded by a timeout that says what it was waiting for.
Nothing in `src/plugin/code.ts` changed, which is what lets this work against a plugin bundle that is already loaded in Figma.

The cost is stated in every write tool's own description: a second writer (a browser tab on the same relay, or the user clicking in the plugin window) produces outcomes that are indistinguishable from ours, so an `update-success` is not proof that THAT write is the one that succeeded.
Every write therefore reports state re-read from the file rather than what it hoped it did.
A correlation id in the envelope, echoed by the sandbox, is the v2 — and it costs every user a plugin rebuild.

**Reads send `ui-ready`, not `refresh`.**
`refresh` also runs `setVariableOrder([])` and `resetHistory()`, so it throws away the user's custom variable ordering and the plugin's whole undo/redo stack.
A read tool that a model may call several times per answer must not do that.
`ui-ready` produces the same `data-loaded` with neither side effect, and it is the cue the bridge already uses for a newly attached tab (`requestFullRefresh` in `src/ui/hooks/useBridge.ts`).

### Publishing `winden-tokens` to npm

The package lives in `bridge/`, with its own `package.json`, and provides two bins: `winden-tokens` (relay + browser UI) and `winden-tokens-mcp` (MCP server).
Its runtime dependencies are `ws` and `@modelcontextprotocol/sdk`, and nothing else.

```bash
cd bridge
npm version patch        # or minor / major
npm publish              # prepack builds and embeds the UI first
```

`prepack` (`bridge/scripts/build-ui.mjs`) runs a `VITE_BRIDGE=1` build of the current source into a temp directory and copies the result to `bridge/ui/index.html`, then refuses to continue if that file contains no bridge client.
So a published relay can never serve a UI that predates its own protocol, and the repo's tracked `dist/` is never touched by a publish.

`bridge/ui/` and `bridge/LICENSE` are generated at pack time and are gitignored.
Check what would ship with `npm pack --dry-run` from `bridge/`: it should be exactly `package.json`, `cli.mjs`, `mcp.mjs`, `mcp-tokens.mjs`, `server.mjs`, `ui/index.html` and `LICENSE`.

**The protocol version is a shipping concern now.**
The envelope carries `v: 1`.
Once the relay is installed globally, an old install will eventually meet a newer plugin; the relay refuses the socket with close code `4002` and a readable reason, logs it, and tells any attached tab, so both halves say what is wrong instead of showing an empty screen.
If you ever change the wire format, bump `PROTOCOL_VERSION` in `bridge/server.mjs` **and** `BRIDGE_PROTOCOL_VERSION` in `src/ui/hooks/useBridge.ts` together.

**Not solved by this package:** a *published* plugin reaching `ws://localhost` needs that entry in `manifest.json`'s `allowedDomains` with a `reasoning`, and Figma's review has to accept it.
Until then this is a dev-machine tool. `allowedDomains` stays `["none"]`.

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
