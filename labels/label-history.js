/**
 * label-history.js — Undo / redo stack for the design studio.
 */
export class HistoryManager {
  constructor(limit = 80) {
    this.limit = limit;
    this.stack = [];
    this.index = -1;
    this._suspend = false;
  }

  /** Push a deep-cloned snapshot. */
  push(snapshot, label = "") {
    if (this._suspend) return;
    const entry = {
      label,
      at: Date.now(),
      data: JSON.parse(JSON.stringify(snapshot))
    };
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(entry);
    if (this.stack.length > this.limit) {
      this.stack.shift();
    } else {
      this.index++;
    }
    this.index = this.stack.length - 1;
  }

  get canUndo() {
    return this.index > 0;
  }

  get canRedo() {
    return this.index >= 0 && this.index < this.stack.length - 1;
  }

  undo() {
    if (!this.canUndo) return null;
    this.index--;
    return JSON.parse(JSON.stringify(this.stack[this.index].data));
  }

  redo() {
    if (!this.canRedo) return null;
    this.index++;
    return JSON.parse(JSON.stringify(this.stack[this.index].data));
  }

  clear() {
    this.stack = [];
    this.index = -1;
  }

  /** Replace current without growing stack (e.g. after load). */
  reset(snapshot, label = "load") {
    this.stack = [
      { label, at: Date.now(), data: JSON.parse(JSON.stringify(snapshot)) }
    ];
    this.index = 0;
  }

  withSuspended(fn) {
    this._suspend = true;
    try {
      return fn();
    } finally {
      this._suspend = false;
    }
  }
}

export default HistoryManager;
