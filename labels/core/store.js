/**
 * DocumentStore — observable single source of truth + undo/redo.
 * UI subscribes; never duplicates the document elsewhere.
 */
import { createDocument, cloneDocument } from "./document.js";

export class DocumentStore {
  /**
   * @param {object} [initial]
   * @param {{ limit?: number }} [opts]
   */
  constructor(initial = null, opts = {}) {
    this._doc = createDocument(initial || {});
    this._listeners = new Set();
    this._history = [];
    this._index = -1;
    this._limit = opts.limit || 100;
    this._suspend = false;
    this._push("init");
  }

  get document() {
    return this._doc;
  }

  /** Alias for callers that prefer method style. */
  get() {
    return this._doc;
  }

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  /**
   * Immutable update: clone → mutator(draft) → commit.
   * Prefer this over mutating `document` in place.
   */
  update(mutator, label = "edit") {
    const draft = cloneDocument(this._doc);
    mutator(draft);
    return this.commit(draft, label);
  }

  _emit(reason) {
    for (const fn of this._listeners) {
      try {
        fn(this._doc, reason);
      } catch (e) {
        console.error("[DocumentStore] listener error", e);
      }
    }
  }

  _push(label) {
    if (this._suspend) return;
    const entry = {
      label: label || "",
      at: Date.now(),
      doc: cloneDocument(this._doc)
    };
    this._history = this._history.slice(0, this._index + 1);
    this._history.push(entry);
    if (this._history.length > this._limit) this._history.shift();
    this._index = this._history.length - 1;
  }

  /** Replace document and record history. */
  commit(next, label = "edit") {
    this._doc = createDocument(next);
    this._push(label);
    this._emit(label);
    return this._doc;
  }

  /** Replace without history (load / remote sync). */
  reset(next, label = "load") {
    this._doc = createDocument(next);
    this._history = [
      { label, at: Date.now(), doc: cloneDocument(this._doc) }
    ];
    this._index = 0;
    this._emit(label);
    return this._doc;
  }

  get canUndo() {
    return this._index > 0;
  }

  get canRedo() {
    return this._index >= 0 && this._index < this._history.length - 1;
  }

  undo() {
    if (!this.canUndo) return this._doc;
    this._index -= 1;
    this._doc = cloneDocument(this._history[this._index].doc);
    this._emit("undo");
    return this._doc;
  }

  redo() {
    if (!this.canRedo) return this._doc;
    this._index += 1;
    this._doc = cloneDocument(this._history[this._index].doc);
    this._emit("redo");
    return this._doc;
  }

  /** Replace without history or emit (live drag preview). */
  replaceQuiet(next) {
    this._doc = createDocument(next);
    return this._doc;
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

export default DocumentStore;
