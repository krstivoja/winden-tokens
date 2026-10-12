# Browser bridge: run the plugin UI in a browser against the open Figma file

## Goal

The Relationships graph is cramped inside the Figma plugin iframe — constant panning on a 678-token file.
Run the same UI full-size in a browser tab, driving the Figma file that is currently open.

Not a shipped feature. A dev-machine tool: it needs `npm run`, so community installs can never use it.
Nothing in the shipped bundle may depend on it, and the production manifest must not carry localhost access.

## Shape

```
Figma plugin UI ──ws──▶ Node relay (127.0.0.1) ──ws──▶ browser tab
       ▲                                                   │
       └──────────── commands ◀────────────────────────────┘
```

`npm run dev:bridge` starts the relay and vite together.
The plugin connects outward on launch; the browser connects outward when opened.
The relay holds no state — it pairs one plugin socket with one or more client sockets and forwards frames.

The plugin window must stay open in Figma: it is the only thing that can call the Figma API.

## Decisions

- Port 9337 by default, `WINDEN_BRIDGE_PORT` to override. Fixed, no scanning — one less thing to debug.
- Relay uses the `ws` package as a **devDependency**. It never enters the plugin bundle.
- Protocol reuses the existing plugin message types verbatim (`refresh`, `create-variable`, `bind-node-property`, …).
      The relay does not interpret them. Adding a plugin command later needs no bridge change.
- Envelope: `{ v: 1, role: 'plugin' | 'client', kind: 'hello' | 'message', payload }`.
- Headless: when a client attaches, the plugin UI collapses to a status strip ("Connected · browser has the wheel").
      Rendering the graph twice would keep paying the iframe cost we just spent a day removing.
- Reconnect: both sides retry with backoff, and the plugin re-sends a full `refresh` on every client `hello`,
      so opening the browser tab late still gets current data.

## Security

A WebSocket handshake is **not** subject to CORS. Any web page the user has open can connect to
`ws://localhost:9337` and, without a check, issue write commands into their Figma file.

Mitigations, both required:

- Relay binds to `127.0.0.1` only, never `0.0.0.0`.
- Relay checks the `Origin` header on handshake:
      `role: 'client'` is accepted only from the vite dev origin (`http://localhost:5173`);
      `role: 'plugin'` is accepted only from the Figma plugin iframe's origin.
      A browser cannot forge `Origin`, so this is sufficient against a hostile page.
      A local process can forge it, but that already implies code execution on the machine.

- [x] Confirmed live: the Figma plugin iframe sends `Origin: null`. `devAllowedDomains` with `ws://localhost:9337` works — the socket is allowed out.
      `[10:35:02.904] OPEN socket #1 accepted (Origin: null)` / `[10:35:02.905] HELLO plugin socket #1 identified`.

## Steps

### Relay — new `bridge/` directory (dev-only, excluded from the build)

- [ ] `bridge/server.mjs`: `ws` server on 127.0.0.1:9337, Origin allowlist, role pairing, frame forwarding.
- [ ] Log connect/disconnect and frame counts. This is the thing you stare at when it does not work.
- [ ] `npm run dev:bridge` — `concurrently` (already a devDependency) running the relay and vite.

### Plugin side

- [ ] `manifest.json`: add `networkAccess.devAllowedDomains: ["ws://localhost:9337"]`.
      Leave `allowedDomains: ["none"]` untouched — production keeps no network access.
      Add `reasoning` if Figma requires it for local servers.
- [x] `src/ui/hooks/useBridge.ts`: connect on mount, fail silently when nothing is listening,
      forward inbound frames into the existing message path, and mirror outbound `post()` calls to the relay.
      Gated by the build-time constant `BRIDGE_ENABLED` (vite dev, or `VITE_BRIDGE=1 npm run build` for Figma).
      A plain `npm run build` drops the client entirely — no `WebSocket` reference is left in `dist/index.html`.
- [x] Headless mode: collapse the plugin UI to a status strip while a client is attached.

### Browser side

- [x] The same UI, served by vite, detects it is not inside Figma and connects to the relay instead.
      One switch at the message-transport boundary (`src/ui/hooks/usePluginMessages.ts`), not a forked UI.

## Verify

- [ ] `npm run build`, `npm test`, `tsc` error count not above baseline (251, all pre-existing).
- [ ] Production build carries no bridge code and no localhost domain in the manifest.
- [ ] End to end: edit a token in the browser, see it change in Figma; select a component in Figma, see the card in the browser.
- [ ] Hostile-origin check: a page on a different origin cannot connect.
- [ ] Closing the plugin window in Figma degrades cleanly — the browser says it lost the document, does not hang.

## Risks

- **The transport switch touches every message in the app.** If `usePluginMessages` is wrong, everything breaks at once, in both environments. Smallest possible change there, and it must no-op when no relay is present.
- Two clients could edit at once (browser + plugin strip). Headless mode makes that unlikely but not impossible.
- Figma's plugin iframe may block outbound WS despite `devAllowedDomains` if the manifest syntax is wrong — verify early, before building anything on top.

## Out of scope

- Any packaged/shipped version for other users.
- Auth beyond the Origin check. Loopback only, dev machine only.
- The MCP server. Same transport could serve it later; not built here.


## Verified live (2026-09-26)

Relay running, bridge-enabled bundle (`VITE_BRIDGE=1 npm run build`) loaded in Figma, browser tab on localhost:5173.

- [x] Figma allows the outbound WebSocket. Plugin iframe Origin is `null`, as the threat model assumed.
- [x] Browser tab receives the real open file: `_global 116 / color 118 / typography 51 / components 342 / dimensions 51`, 678 variables, 443 colors, 511 references.
- [x] Relationships graph renders the whole real file at browser size.
- [x] Figma selection propagates to the browser — the component selection card appears for the node selected in Figma.
- [x] Origin check rejects a hostile origin with 403 before upgrade; loopback binding proved with `lsof`/`nc`.
- [x] Production build contains no bridge code: `grep -c WebSocket dist/index.html` → 0, `ws://localhost` → 0.
- [x] Gates in the main checkout: build OK, 136 tests passing (114 baseline + 22 new), tsc exactly 251.

## Bugs found during the live test — fixed 2026-09-26

1. **Frame amplification.** Fixed.
      Two real mechanisms, both per client: the relay forwards every client `hello` to the plugin, which answers with `requestFullRefresh()`, *and* the browser tab's own `App` mount posted `ui-ready` + `get-history-state` again — two full reads of a 678-variable file per tab, times the number of tabs.
      `requestFullRefresh()` is now coalesced while a refresh is outstanding (cleared when the mirror sees `data-loaded`), and a browser tab no longer sends the bootstrap pair at all (`BROWSER_SUPPRESSED_MESSAGES`).
      One attach = one `ui-ready` = one `data-loaded` + one `selection-changed`, however many tabs attach at once.
      The mirror's missing `BRIDGE_EVENT_TAG` filter was NOT a live mechanism — only the client role re-emits tagged frames and only the plugin role mirrors, so the two never met. The guard is in anyway, as an invariant.

2. **First load is very slow.** Cause still not established; measurement needs Figma.
      Bug 1 halved the number of full `fetchData` runs per tab load (2 → 1), and `ui-ready` also runs `sendSelection()`, which is where the extra `selection-changed` frames came from.
      Whether a single run still takes a minute on this file is unmeasured — no way to run `fetchData` outside Figma.
      To measure: in the relay log, diff the `FWD client #N → plugin kind=hello` line against the next `FWD plugin → N client(s) type=data-loaded`. That is one full refresh, end to end, and needs no code change.

3. **The browser tab sends `resize` to the plugin.** Fixed.
      Generalised: a tab may drive the *document* and never the *plugin window*, and must not repeat what the bridge handshake already sends for it. The rule and its list live in `BROWSER_SUPPRESSED_MESSAGES` (`src/ui/hooks/useBridge.ts`), dropped in `post()` before the outbound queue.

4. **The browser gave no sign the plugin was gone.** Fixed.
      `decodeEnvelope` rejected the relay's own frames (`role: 'relay'`, `kind: 'status'`), so `bridge/plugin-connected` / `bridge/plugin-disconnected` were dropped unread — and since the relay never forwards the plugin's `hello` to clients, a tab's `peerAttached` was in fact *never* true. The tab had no signal at all.
      The envelope now carries the relay role, and a detached tab shows a persistent banner until the plugin attaches.

5. **A tab attached before the plugin never got data.** Fixed (found while fixing 2).
      The relay forwards a client `hello` only if a plugin is already connected; when the plugin connects later it sends `bridge/client-attached` instead, which nothing was listening to. The plugin now treats that as a refresh cue (coalesced), and `bridge/client-detached` with `clients: 0` leaves headless mode.

6. **The plugin gave up on a relay that was not running yet.** Fixed.
      Four cold attempts (~15s) meant the normal dev order — Figma first, `npm run dev:bridge` second — could only be recovered by reopening the plugin window. Both roles now retry for the life of the window with the backoff capped at 15s. A production build still contains no WebSocket code, which is what makes an endless retry loop affordable.

## Still open

- [ ] Headless strip unverified in Figma — built and checked in the browser only.
- [x] Closing the plugin degrades cleanly in the browser — verified against the real relay with the real client code, not in Figma: both tabs flipped to "no plugin" within 1ms of the socket closing and back when it returned.
- [ ] Writing from the browser back into Figma (edit a token, see it change) not yet exercised.

## Decided: a second, minimal UI entry point (2026-09-26)

The plugin currently loads the full 1.15MB app and mounts React just to show a status strip in headless mode.
A separate "Winden Bridge" plugin was considered and rejected: `src/plugin/code.ts` (~4,500 lines) is exactly the part that must come along, since it executes the Figma API calls, so only the UI half would shrink — at the cost of a second manifest, a second plugin id, a second install, and a duplicated or awkwardly shared sandbox.

Instead: same plugin, second entry point, selected by a menu command.
Figma supports this — `ui` may be a map of command to HTML, `menu` declares the commands, and the sandbox picks with `figma.command` + `__uiFiles__` (verified against the current manifest docs).

```json
"ui": { "open": "dist/index.html", "bridge": "dist/bridge.html" },
"menu": [
  { "name": "Open Winden Tokens", "command": "open" },
  { "name": "Bridge to browser (dev)", "command": "bridge" }
]
```

`bridge.html` is the WS client, a connection indicator, and the message relay — no React app, no contexts, no graph.
The plugin-role relay logic already exists in `useBridge` (forward sandbox messages out, hand browser commands to `parent`), so the entry is that plus a status line.

User decided the menu item **ships to everyone**, named so it reads as developer-only.
The alternative — keeping it out of the production manifest behind the existing `VITE_BRIDGE` split — was declined.

- [ ] Build it. Queued behind the bug-fix pass, because both touch `src/ui/hooks/useBridge.ts`.
