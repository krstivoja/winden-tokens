#!/usr/bin/env node
/**
 * Prepack step for the `winden-tokens` package.
 *
 * Builds the browser UI from the CURRENT source of this repo and copies the
 * single-file result into `bridge/ui/index.html`, which is what the relay
 * serves. Wired as `prepack`, so it runs for both `npm pack` and `npm publish`
 * and a published relay can never serve a UI that predates its own protocol.
 *
 * Two things it deliberately does NOT do:
 *
 *   - It does not run the repo's `npm run build`. That writes `dist/index.html`,
 *     which is TRACKED and is the file Figma loads for a production plugin.
 *     Overwriting it with a VITE_BRIDGE=1 bundle would quietly put bridge code
 *     into the shipped plugin. This builds to a temp directory instead and
 *     leaves `dist/` exactly as it found it.
 *
 *   - It does not trust the build. It asserts the copied HTML actually contains
 *     the bridge client before letting the pack proceed: a package that shipped
 *     a plain production UI would serve a page that silently never connects,
 *     which is the single worst failure this whole thing can have.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_DIR = dirname(dirname(fileURLToPath(import.meta.url))); // bridge/
const REPO_ROOT = dirname(PKG_DIR);
const VITE_BIN = join(REPO_ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

function die(message) {
  console.error(`\n  prepack failed: ${message}\n`);
  process.exit(1);
}

if (!existsSync(join(REPO_ROOT, 'src', 'ui', 'index.html'))) {
  die(
    `no plugin source tree at ${REPO_ROOT}.\n` +
      `  This package is built from the winden-tokens repo; pack it from there.`
  );
}

if (!existsSync(VITE_BIN)) {
  die(`vite is not installed at ${VITE_BIN}. Run \`npm install\` in ${REPO_ROOT}.`);
}

const outDir = mkdtempSync(join(tmpdir(), 'winden-bridge-ui-'));

try {
  console.log(`  building the bridge UI (VITE_BRIDGE=1) → ${outDir}`);

  const build = spawnSync(
    process.execPath,
    [VITE_BIN, 'build', '--outDir', outDir, '--emptyOutDir'],
    {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: { ...process.env, VITE_BRIDGE: '1' },
    }
  );

  if (build.status !== 0) {
    die(`vite build exited with ${build.status}.`);
  }

  const built = join(outDir, 'index.html');
  if (!existsSync(built)) {
    die(`vite produced no ${built}.`);
  }

  const html = await readFile(built, 'utf8');

  // The guarantee this whole script exists for.
  if (!html.includes('WebSocket')) {
    die(
      'the built UI contains no WebSocket code, so VITE_BRIDGE did not take effect.\n' +
        '  Shipping it would serve a page that can never reach the relay.'
    );
  }

  await mkdir(join(PKG_DIR, 'ui'), { recursive: true });
  await copyFile(built, join(PKG_DIR, 'ui', 'index.html'));

  // npm only picks up a LICENSE that sits in the package directory.
  const license = join(REPO_ROOT, 'LICENSE');
  if (existsSync(license)) await copyFile(license, join(PKG_DIR, 'LICENSE'));

  console.log(`  bridge UI ready: ${join(PKG_DIR, 'ui', 'index.html')} (${html.length} bytes)`);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
