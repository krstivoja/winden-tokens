// Keeps xyflow's "zoom key held" flag honest.
//
// With `panOnScroll`, Cmd+scroll zooms only while xyflow believes the zoom key
// is down, and it learns that from document keydown/keyup. It misses them when
// focus sits in an input (the sidebar search, an inline edit) or the key went
// to another window, so Cmd+scroll "sometimes works" and a missed keyup leaves
// zoom stuck on. A wheel event always carries the truth in `metaKey`, so each
// one tells xyflow what the key really is, by replaying the key event it missed.

import { useEffect } from 'react';
import type { RefObject } from 'react';

const META_INIT = { key: 'Meta', code: 'MetaLeft', bubbles: true } as const;

export function useZoomKeySync(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    // Whether xyflow may think the key is down: set by any Meta keydown seen
    // (real or ours), cleared by any keyup. A real keyup it missed leaves this
    // true, which is the "zoom stuck on" case.
    let maybeDown = false;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Meta') maybeDown = event.type === 'keydown';
    };
    const onWheel = (event: WheelEvent) => {
      // The graph may mount after this hook (an early return renders another
      // view first), so look the container up per event.
      if (!(event.target instanceof Node) || !containerRef.current?.contains(event.target)) return;
      if (event.metaKey) {
        document.dispatchEvent(new KeyboardEvent('keydown', { ...META_INIT, metaKey: true }));
      } else if (maybeDown) {
        document.dispatchEvent(new KeyboardEvent('keyup', META_INIT));
      }
    };
    // Capture on the document: runs before xyflow's own wheel handling.
    document.addEventListener('wheel', onWheel, { capture: true, passive: true });
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('keyup', onKey, true);
    return () => {
      document.removeEventListener('wheel', onWheel, { capture: true });
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('keyup', onKey, true);
    };
  }, [containerRef]);
}
