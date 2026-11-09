// Entry for dist/bridge.html, the "Bridge to browser" window. No React: this
// window only relays messages and shows one status line.

import { PluginBridge, sandboxMessageFrom } from './client';
import { requestPluginKey, SANDBOX_OPEN_UI } from './key';
import { BRIDGE_UI_URL, BRIDGE_URL } from './protocol';
import { viewFor, type BridgePhase } from './state';

function postToSandbox(message: Record<string, unknown>): void {
  window.parent.postMessage({ pluginMessage: message }, '*');
}

function onSandboxMessage(handler: (message: Record<string, unknown>) => void): () => void {
  const listener = (event: MessageEvent) => {
    const message = sandboxMessageFrom(event.data);
    if (message) handler(message);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

function el<K extends keyof HTMLElementTagNameMap>(id: string): HTMLElementTagNameMap[K] {
  const node = document.getElementById(id);
  if (!node) throw new Error(`bridge.html is missing #${id}`);
  return node as HTMLElementTagNameMap[K];
}

const root = el<'div'>('bridge');
const title = el<'p'>('bridge-title');
const detail = el<'p'>('bridge-detail');
const detailText = el<'span'>('bridge-detail-text');
const detailCode = el<'code'>('bridge-detail-code');
const copyButton = el<'button'>('bridge-copy');
const retry = el<'button'>('bridge-retry');
const openLink = el<'button'>('bridge-open');

openLink.title = BRIDGE_UI_URL;

function render(state: BridgePhase): void {
  const view = viewFor(state);
  root.dataset.tone = view.tone;
  title.textContent = view.title;
  detail.hidden = !view.detail;
  detailText.textContent = view.detail?.text ?? '';
  detailCode.textContent = view.detail?.code ?? '';
  detailCode.hidden = !view.detail?.code;
  copyButton.hidden = !view.detail?.code;
  retry.hidden = !view.retry;
  openLink.hidden = !view.openLink;
}

const bridge = new PluginBridge({
  url: BRIDGE_URL,
  createSocket: (url) => new WebSocket(url),
  postToSandbox,
  onSandboxMessage,
});

/** Figma's iframe often denies navigator.clipboard, so fall back to execCommand. */
function copyText(text: string): boolean {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(field);
  field.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

let copiedTimer: number | undefined;
copyButton.addEventListener('click', () => {
  const text = detailCode.textContent ?? '';
  if (!text || !copyText(text)) return;
  copyButton.dataset.copied = 'true';
  copyButton.title = 'Copied';
  window.clearTimeout(copiedTimer);
  copiedTimer = window.setTimeout(() => {
    delete copyButton.dataset.copied;
    copyButton.title = 'Copy';
  }, 1500);
});

bridge.onState(render);
render(bridge.getState());
retry.addEventListener('click', () => bridge.retry());
// A plain link is not reliable inside Figma desktop's iframe; the sandbox opens it.
openLink.addEventListener('click', () => postToSandbox({ type: SANDBOX_OPEN_UI }));

void requestPluginKey({ post: postToSandbox, listen: onSandboxMessage }).then((key) => bridge.start(key));
