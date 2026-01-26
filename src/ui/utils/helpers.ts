// Helper utilities

export function esc(s: string | null | undefined): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function post(msg: Record<string, unknown>): void {
  parent.postMessage({ pluginMessage: msg }, '*');
}

export function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}
