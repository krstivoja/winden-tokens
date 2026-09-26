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

- [ ] Confirm what `Origin` the Figma plugin iframe actually sends (likely `null`) before relying on it.
      If it is `null`, accept `null` for the plugin role only, and document why.

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
