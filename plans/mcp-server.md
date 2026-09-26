# MCP server: manage tokens from Claude

## Goal

Talk to the open Figma file from Claude — read the token structure, create and edit variables — without a browser tab.

## Shape

A third role on the relay that already exists. Nothing new in the plugin sandbox.

```
Claude ──stdio──▶ winden-tokens-mcp ──ws──▶ relay ──ws──▶ plugin ──▶ Figma API
```

The relay already forwards the plugin's whole message vocabulary (`refresh`, `create-variable`, `update-variable-value`, `rename-group`, `delete-variable`, …) and already pairs roles. The MCP server is another thing allowed to send those messages.

Ships as a second `bin` in the `winden-tokens` package, so one global install gives both the browser view and the MCP server.

## The hard part: request/response over a broadcast protocol

The existing protocol is fire-and-forget. The plugin broadcasts to every attached client; nothing correlates a reply to a request. MCP is request/response.

**Decision: correlate by outcome, not by id — no plugin changes in v1.**

- Reads: send `refresh`, await the next `data-loaded`, answer from that snapshot. One message type covers collections, variables, modes and references.
- Writes: send the command, await `update-success` / `update-error`, then refresh.
- Every wait is bounded by a timeout that reports plainly what it was waiting for.

Adding a correlation id to the envelope and echoing it from `src/plugin/code.ts` would be cleaner and is the obvious v2. It touches ~4,500 lines of sandbox code and is not worth blocking this on. Write the reasoning down rather than discovering it again later.

Consequence to state in the tool descriptions: two clients writing at once can interleave, so a write's `update-success` is not proof that THAT write is the one that succeeded. Acceptable for a single-user dev machine; not acceptable if this ever becomes multi-user.

## Tools

Read (safe, unattended):
- `list_collections` — collections, their modes, variable counts.
- `list_variables` — filter by collection, group prefix, type.
- `get_variable` — one variable: value per mode, what it references, what references it.

Write (each needs an explicit decision about whether it can run unattended):
- `create_variable` — collection, name, type, value.
- `set_variable_value` — by id, per mode; a raw value or a reference to another variable.
- `rename_variable`, `delete_variable`.
- `create_collection`, `create_group`.

Deliberately NOT in v1:
- Binding a variable to a node property — it depends on the current Figma selection, which Claude cannot see or reason about safely.
- Anything that rewrites many variables in one call. `rename-group` already exists as a plugin command and is exactly the kind of operation that silently rewires dozens of components.

## Safety

- Loopback only, inherited from the relay.
- `delete_variable` and `rename_variable` are destructive and not reversible from Claude's side — Figma's own undo is the user's only recovery. Mark them clearly in their descriptions so a client can gate them.
- The MCP server must refuse to start if the relay is not running, with a message saying how to start it, rather than hanging.
- A Node process sends no `Origin` header, and the relay currently treats an absent Origin as "the Figma plugin iframe". Adding a third role from that same condition needs thinking about — a local process could already claim the plugin role today, so this may change nothing, but decide it deliberately and write down why.

## Steps

- [ ] `mcp` role in the relay: may send commands, receives plugin broadcasts, never impersonates the plugin.
- [ ] `winden-tokens-mcp` bin: stdio MCP server, `@modelcontextprotocol/sdk`.
- [ ] Read tools over the `refresh` → `data-loaded` snapshot.
- [ ] Write tools over the existing plugin commands, each awaiting its outcome.
- [ ] Bounded waits with legible timeout errors.
- [ ] `specs/devnotes.md`: the one-line client config.

## Verify

- [ ] Against the real open file: list collections, read a variable's references, create a variable and see it appear in Figma.
- [ ] Relay not running → a clear refusal, not a hang.
- [ ] Plugin window closed → same.
- [ ] The production plugin build still contains no bridge code.

## After this

The conventions — how tiers are decided, naming grammar, what may reference what — are what make these tools produce CORRECT tokens rather than merely valid ones. One source of truth in the repo, exposed as an MCP resource (so it reaches Claude chat, which a local skill does not) and wrapped as a skill for working in this repo. Drafted from the live file, corrected by the user.
