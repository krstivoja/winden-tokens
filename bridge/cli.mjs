#!/usr/bin/env node
/**
 * `winden-tokens` — the executable published to npm.
 *
 * Starts the bridge relay (see ./server.mjs) and serves the prebuilt browser UI
 * from the same origin, then opens a browser at it. A user needs this package
 * and Node; they need neither the plugin's source tree nor vite.
 *
 * The UI is resolved in this order:
 *   1. ./ui/index.html      — shipped in the published tarball (see scripts/build-ui.mjs)
 *   2. ../dist/index.html   — this repo's own build, so a checkout works without packing
 *   3. nothing              — the relay still runs; `/` explains what is missing
 *
 * `--dev` flips 1 and 2. A maintainer who has run `npm pack` has a `ui/` in
 * their checkout, and it would otherwise shadow the build they just made —
 * serving yesterday's UI while they debug today's.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_PORT, HOST, PROTOCOL_VERSION, startRelay } from './server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const HELP = `
  winden-tokens — run the Winden Tokens UI in a browser, driving the Figma file
  that is currently open.

  Usage
    winden-tokens [options]

  Options
    --port <n>     Port for the relay and the UI (default ${DEFAULT_PORT}).
    --no-open      Do not open a browser.
    --dev          Also accept a client from the vite dev server
                   (http://localhost:5173). Only for developing the UI itself.
    -h, --help     This text.
    -v, --version  Print the version.

  Environment
    WINDEN_BRIDGE_PORT   same as --port
    WINDEN_BRIDGE_DEV=1  same as --dev

  How to use it
    1. Run this command. It prints a URL and opens it.
    2. Open the Winden Tokens plugin in Figma, on the file you want to work on.
       The plugin window must stay open: it is the only thing that can talk to
       the Figma API. It collapses to a status strip while the tab has the wheel.
    3. The browser tab now shows that file, full size.

  About --port
    The port is part of the contract, not a free choice. The Figma plugin can
    only open a socket to a host its manifest lists, and the manifest lists
    ws://localhost:${DEFAULT_PORT}. Moving the relay with --port also needs the plugin's
    manifest.json to list the new port, or the plugin will never connect.
    Use it to dodge a port conflict only if you can rebuild the plugin too.

  Security
    The relay binds 127.0.0.1 only, and refuses any WebSocket whose Origin is
    not the page it served itself. A WebSocket handshake is not subject to
    CORS, so that check is the only thing between a hostile page and your
    Figma file. Do not widen it.
`;

function parseArgs(argv) {
  const opts = {
    port: null,
    open: true,
    dev: process.env.WINDEN_BRIDGE_DEV === '1' || process.env.WINDEN_BRIDGE_DEV === 'true',
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--version' || arg === '-v') {
      opts.version = true;
    } else if (arg === '--no-open') {
      opts.open = false;
    } else if (arg === '--open') {
      opts.open = true;
    } else if (arg === '--dev') {
      opts.dev = true;
    } else if (arg === '--port') {
      opts.port = argv[++i];
    } else if (arg.startsWith('--port=')) {
      opts.port = arg.slice('--port='.length);
    } else {
      fail(`Unknown option: ${arg}\nRun \`winden-tokens --help\`.`);
    }
  }

  return opts;
}

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

/** A port is either a valid integer in range or a hard error — never a fallback. */
function resolvePort(fromFlag) {
  const raw = fromFlag ?? process.env.WINDEN_BRIDGE_PORT;
  if (raw === undefined || raw === null || raw === '') return DEFAULT_PORT;

  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    fail(`"${raw}" is not a valid port (1-65535).`);
  }
  return n;
}

function resolveUiFile(dev) {
  const packaged = join(HERE, 'ui', 'index.html');
  const checkout = join(HERE, '..', 'dist', 'index.html');

  for (const candidate of dev ? [checkout, packaged] : [packaged, checkout]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Open the platform's default browser.
 *
 * `child_process` and the platform's own opener on purpose — this package has
 * exactly one runtime dependency (`ws`) and is not spending a second one on
 * three lines of argv. No shell: the URL is built from a validated integer
 * port, and passing it as an argv entry keeps it that way.
 */
function openBrowser(url) {
  const [command, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];

  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.on('error', () => {
      console.log(`  (could not launch a browser — open ${url} yourself)`);
    });
    child.unref();
  } catch {
    console.log(`  (could not launch a browser — open ${url} yourself)`);
  }
}

async function version() {
  try {
    const pkg = JSON.parse(await readFile(join(HERE, 'package.json'), 'utf8'));
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(HELP);
    return;
  }

  if (opts.version) {
    console.log(await version());
    return;
  }

  const port = resolvePort(opts.port);
  const uiFile = resolveUiFile(opts.dev);

  let relay;
  try {
    relay = await startRelay({ port, dev: opts.dev, uiFile });
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      fail(
        `Cannot start: ${HOST}:${port} is already in use.\n` +
          `  Another winden-tokens is probably already running — try opening\n` +
          `  http://${HOST}:${port}/ instead. Otherwise stop it, or pass --port\n` +
          `  (and see \`winden-tokens --help\` about what --port does NOT change).`
      );
    }
    fail(`Cannot start: ${err.message}`);
    return;
  }

  console.log(`\n  Winden Tokens bridge — protocol v${PROTOCOL_VERSION}`);
  console.log(`  UI:    ${relay.url}`);
  console.log(`  Relay: ws://${HOST}:${port}`);
  if (!uiFile) {
    console.log('\n  NOTE: no browser UI is bundled with this relay, so the URL above is empty.');
  }
  console.log('\n  Now open the Winden Tokens plugin in Figma and leave that window open.');
  console.log('  Ctrl-C to stop.\n');

  if (opts.open && uiFile) openBrowser(relay.url);

  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      relay.close().then(() => process.exit(0));
      setTimeout(() => process.exit(0), 500).unref();
    });
  }
}

main().catch((err) => {
  fail(err?.stack ?? String(err));
});
