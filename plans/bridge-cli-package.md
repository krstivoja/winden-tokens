# Ship the bridge as `winden-tokens` on npm

## Goal

`npm install -g winden-tokens`, then one command starts everything: the relay AND the browser UI.
Today a user needs the repo, `npm install`, and `npm run dev:bridge` — vite included. After this, vite is only needed by someone developing the UI itself.

## Shape

One published package containing the relay and the PREBUILT UI.

```
winden-tokens            → starts relay + HTTP on 127.0.0.1:9337, opens the browser
winden-tokens --port N   → another port (the plugin manifest must agree, see Risks)
winden-tokens --no-open  → do not open a browser
```

The relay already runs an HTTP server that the WebSocket upgrades from; it now also serves `index.html` from the package.
The page and the socket become SAME-ORIGIN, which makes the Origin check stricter than it is today, not looser.

## Decisions

- **Package name `winden-tokens`** — unclaimed on the registry (404), as are `winden-bridge` and `@dplugins/winden-tokens`.
- **The built UI ships inside the package.** No CDN, no network fetch: the whole point is that a design system's tokens never leave the machine.
- **The package is built from this repo, not hand-maintained.** A prepublish step runs `VITE_BRIDGE=1 npm run build` and copies `dist/index.html` in, so a published relay can never serve a UI that predates its own protocol.
- **Version handshake.** Once the relay ships separately, an old global install can meet a new plugin. The envelope already carries `v: 1`; a mismatch must say so in plain words on both sides rather than failing as a silent no-data screen.
- **Global install is the documented path** (the user asked for it), `npx winden-tokens` works from the same package and is what keeps a user current.
- **Publishing is the user's to run.** Prepare everything; `npm publish` is theirs.

## Steps

- [x] Package directory with its own `package.json`: `bin`, `files`, `engines`, `ws` as the only runtime dependency. — `bridge/package.json`, name `winden-tokens`, version `0.1.0`.
- [x] Serve `index.html` (and any asset) from the same server the WS upgrades from. — `GET /` and `/index.html`, plus `/healthz`; everything else 404. `no-store`, `nosniff`. A Host check refuses anything that is not a loopback name (DNS rebinding).
- [x] Tighten the Origin allowlist: the relay's own origin, plus the vite origin only when it is being used for development. — the signal is an explicit `--dev` flag (or `WINDEN_BRIDGE_DEV=1`), set by `npm run dev:bridge` and by nothing a published install does.
- [x] `--port` / `--no-open` / `--help`, and open the browser by default. — also `--dev` and `--version`. Browser opened with `child_process` and the platform opener, no dependency. `--help` states the fixed-port contract.
- [x] Protocol-version check on the hello handshake, with a readable message on both sides. — version is checked FIRST, before role and origin. Relay logs three lines and closes with `4002`; the refused side shows the close reason as a banner and stops retrying; any attached tab gets a `bridge/version-mismatch` status and shows the same banner.
- [x] Prepublish build wiring so the shipped UI is built from the current source. — `prepack` → `bridge/scripts/build-ui.mjs`, which builds `VITE_BRIDGE=1` into a temp dir (never touching the tracked `dist/`) and refuses to pack a UI with no bridge client in it.
- [x] `specs/devnotes.md`: how to run it, how to publish it, and that vite is now only for UI development.

## Risks

- **The manifest question is NOT solved by this.** A published plugin reaching `ws://localhost` needs that entry in `allowedDomains` WITH `reasoning`, and Figma's review has to accept it. This package is useful regardless — it is how the dev-machine bridge should have been packaged — but it does not become a feature for community installs until review says yes. The production manifest stays untouched here.
- **Users need Node.** `npx`/`npm -g` assume it. A standalone binary is a separate distribution problem.
- **A fixed port is part of the contract.** The plugin can only connect to what its manifest lists, so `--port` helps a user with a conflict only if the manifest lists that port too. Say so in `--help` rather than implying free choice.

## Verify

- [x] `npm pack` produces a tarball containing the built UI and nothing from `src/`, `tests/` or `plans/`. — 5 files, 377.7 kB: `package.json`, `cli.mjs`, `server.mjs`, `ui/index.html`, `LICENSE`.
- [x] Install the tarball globally in a scratch prefix, run the binary, and confirm the UI is served and the WS accepts a plugin socket. — done on port 19337: page served byte-identical to the packaged UI, client accepted from the relay's own origin, plugin accepted from a null Origin, hostile origin and the vite origin both 403, a `v: 2` hello closed 4002.
- [x] The production plugin build still contains no bridge code (`grep -c WebSocket dist/index.html` → 0).

## Built 2026-09-26

Gates: build clean, `grep -c WebSocket dist/index.html` → **0**, vitest **323 passing** (302 baseline + 21 new), `tsc --noEmit` **exactly 251** (unchanged baseline).

### Judgement calls

- **Package root is `bridge/`**, not a new `packages/` tree. The relay is already there, the `files` list is naturally tight, and nothing had to move.
- **`--dev` is an explicit flag, never inferred.** "Is there a checkout next to me?" would be a signal a user could enter by accident, and the thing it unlocks is an entry on the Origin allowlist.
- **The prepack build goes to a temp directory, not `dist/`.** The plan said "runs `VITE_BRIDGE=1 npm run build` and copies `dist/index.html`", but `dist/index.html` is tracked and is what Figma loads for a production plugin; a publish that left a bridge bundle there could put bridge code into a shipped plugin. Same guarantee, no side effect.
- **`src/ui/hooks/useBridge.ts` needed one change beyond the version handshake:** a browser tab now derives its socket URL from `window.location` instead of the hard-coded `ws://localhost:9337`. Without it `--port` serves a page that talks to the wrong port. The plugin role is untouched and still uses the fixed manifest port.
- **Version `0.1.0`**, because the manifest/review question in Risks is still open and this is not yet a feature anyone can install.

### Still open

- No `README.md` in the package (CLAUDE.md forbids creating one unasked). npm will warn at publish and the registry page will be blank.
- `manifest.json` untouched, as required. The Risks section above still stands.
