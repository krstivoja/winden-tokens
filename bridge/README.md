# winden-tokens

Run the [Winden Tokens](https://windentokens.com) Figma plugin in a full-size browser window, driving the Figma file you have open.

A Figma plugin panel is small; a design system with several hundred variables is not. This serves the same interface to a browser tab on your own machine.

## Install

```bash
npm install -g winden-tokens
```

Node.js 18 or newer. To run it without installing: `npx winden-tokens`.

## Use

```bash
winden-tokens
```

That starts a local server and opens the browser. Then open the Winden Tokens plugin in Figma — the tab fills with the variables of your open file.

Keep the plugin window open: it is the only thing that can reach the Figma API, and the browser tab is a remote control with no document of its own. Order does not matter, both sides reconnect on their own.

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

It needs `winden-tokens` running and the plugin open in Figma, the same as the browser view. It can list collections, read a variable and everything it references, create variables, groups and collections, and set values. If the relay or the plugin is not there, a tool fails immediately and says which.

Renaming and deleting a variable are not reversible from Claude's side — Figma's own undo is the only recovery.

## Your tokens stay on your machine

The server listens on `127.0.0.1` only, so nothing on your network can reach it. It checks the origin of every connection before accepting one, so a web page you happen to have open cannot connect and issue commands into your Figma file. It stores nothing — it forwards messages and forgets them.

## Links

- [windentokens.com](https://windentokens.com) — the plugin, and what it does
- [GitHub](https://github.com/krstivoja/winden-tokens) — source, issues
- [Figma Community](https://windentokens.com) — install the plugin

MIT © [DPlugins](https://dplugins.com)
