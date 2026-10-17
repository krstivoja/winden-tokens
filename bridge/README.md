# winden-tokens

Run the [Winden Tokens](https://windentokens.com) Figma plugin in a full-size browser window, driving the Figma file you have open.

A Figma plugin panel is small; a design system with several hundred variables is not. This serves the same interface to a browser tab on your own machine.

## Use

```bash
npx winden-tokens
```

That starts a local server on `127.0.0.1:9337` and opens the browser. Node.js 18 or newer. To keep it installed: `npm install -g winden-tokens`.

Then, in Figma, on the file you want to work on, run **Plugins → Winden Tokens → Bridge to browser**. That opens a small status window; the full app is still "Open Winden Tokens".

The first time, the browser tab shows a pairing request with a 6-character code. Check that it matches the code in the Figma window, then click Approve. Only approve a code you see in your own Figma window. After that the plugin is trusted, and the tab fills with the variables of your open file.

Keep the Figma bridge window open: it is the only thing that can reach the Figma API, and the browser tab is a remote control with no document of its own. Order does not matter, both sides reconnect on their own.

Trusted plugins are stored as hashes in `~/.winden-tokens/trusted-plugins.json`. Delete an entry to revoke it.

If the bridge window or the tab says "Update winden-tokens", the plugin and the relay speak different protocol versions. Run `npx winden-tokens@latest`.

| | |
|---|---|
| `--port N` | Use a different port. The Figma plugin can only connect to the port its manifest declares. |
| `--no-open` | Do not open a browser. |
| `--help` | All options. |

## Manage tokens from Claude

The package also installs an MCP server, so Claude can read and edit the variables in your open Figma file:

```bash
claude mcp add winden-tokens -- winden-tokens-mcp
```

It needs `winden-tokens` running first and the Bridge to browser window open in Figma, the same as the browser view. It authenticates with a token the relay writes to `~/.winden-tokens/mcp-token` (readable only by you); set `WINDEN_TOKENS_HOME` to use another directory than `~/.winden-tokens`. It can list collections, read a variable and everything it references, create variables, groups and collections, and set values. If the relay or the plugin is not there, a tool fails immediately and says which.

Renaming and deleting a variable are not reversible from Claude's side — Figma's own undo is the only recovery.

## Your tokens stay on your machine

The server listens on `127.0.0.1` only, so nothing on your network can reach it. A web page you happen to have open cannot act as the browser tab: the relay checks the origin of every connection. The Figma plugin and the MCP server connect without a usable origin (any sandboxed frame on any website looks the same), so they are authenticated differently: the plugin must be approved once with the pairing code, and the MCP server must present the token file. It stores no tokens of yours — it forwards messages and forgets them.

## Links

- [windentokens.com](https://windentokens.com) — the plugin, and what it does
- [GitHub](https://github.com/krstivoja/winden-tokens) — source, issues
- [Figma Community](https://windentokens.com) — install the plugin

MIT © [DPlugins](https://dplugins.com)
