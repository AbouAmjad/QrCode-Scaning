/**
 * editor/shortcuts.js
 */
export function bindShortcuts(handlers, { isEnabled } = {}) {
  const onKey = (e) => {
    if (typeof isEnabled === "function" && !isEnabled()) return;
    const tag = (e.target && e.target.tagName) || "";
    const typing =
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      e.target?.isContentEditable;
    const mod = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const key = e.key;

    if (mod && key.toLowerCase() === "z" && !shift) {
      e.preventDefault();
      handlers.undo?.();
      return;
    }
    if (mod && (key.toLowerCase() === "y" || (key.toLowerCase() === "z" && shift))) {
      e.preventDefault();
      handlers.redo?.();
      return;
    }
    if (typing) return;

    const map = {
      c: () => handlers.copy?.(),
      x: () => handlers.cut?.(),
      v: () => handlers.paste?.(),
      d: () => handlers.duplicate?.(),
      a: () => handlers.selectAll?.()
    };
    if (mod && map[key.toLowerCase()]) {
      e.preventDefault();
      map[key.toLowerCase()]();
      return;
    }
    if (mod && key.toLowerCase() === "s") {
      e.preventDefault();
      handlers.save?.();
      return;
    }
    if (mod && key.toLowerCase() === "g") {
      e.preventDefault();
      if (shift) handlers.ungroup?.();
      else handlers.group?.();
      return;
    }
    if (key === "Delete" || key === "Backspace") {
      e.preventDefault();
      handlers.delete?.();
      return;
    }
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key)) {
      e.preventDefault();
      const step = shift ? 1 : 0.25;
      const dx = key === "ArrowLeft" ? -step : key === "ArrowRight" ? step : 0;
      const dy = key === "ArrowUp" ? -step : key === "ArrowDown" ? step : 0;
      handlers.nudge?.(dx, dy);
    }
  };

  const onWheel = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (typeof isEnabled === "function" && !isEnabled()) return;
    e.preventDefault();
    handlers.zoom?.(e.deltaY > 0 ? -1 : 1);
  };

  window.addEventListener("keydown", onKey);
  window.addEventListener("wheel", onWheel, { passive: false });
  return () => {
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("wheel", onWheel);
  };
}
