/**
 * label-shortcuts.js — Keyboard shortcuts for the design studio.
 */
export function bindShortcuts(handlers, { target = window, isEnabled } = {}) {
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

    if (mod && key.toLowerCase() === "c") {
      e.preventDefault();
      handlers.copy?.();
      return;
    }
    if (mod && key.toLowerCase() === "x") {
      e.preventDefault();
      handlers.cut?.();
      return;
    }
    if (mod && key.toLowerCase() === "v") {
      e.preventDefault();
      handlers.paste?.();
      return;
    }
    if (mod && key.toLowerCase() === "d") {
      e.preventDefault();
      handlers.duplicate?.();
      return;
    }
    if (mod && key.toLowerCase() === "a") {
      e.preventDefault();
      handlers.selectAll?.();
      return;
    }
    if (mod && key.toLowerCase() === "g" && !shift) {
      e.preventDefault();
      handlers.group?.();
      return;
    }
    if (mod && key.toLowerCase() === "g" && shift) {
      e.preventDefault();
      handlers.ungroup?.();
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
      return;
    }
    if (key === "]" && mod) {
      e.preventDefault();
      handlers.bringForward?.();
      return;
    }
    if (key === "[" && mod) {
      e.preventDefault();
      handlers.sendBackward?.();
      return;
    }
  };

  const onWheel = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (typeof isEnabled === "function" && !isEnabled()) return;
    e.preventDefault();
    handlers.zoom?.(e.deltaY > 0 ? -1 : 1, e);
  };

  target.addEventListener("keydown", onKey);
  target.addEventListener("wheel", onWheel, { passive: false });

  return () => {
    target.removeEventListener("keydown", onKey);
    target.removeEventListener("wheel", onWheel);
  };
}

export default { bindShortcuts };
