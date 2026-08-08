/**
 * Shared constants — page modes, handle names, zoom steps.
 * No runtime state.
 */

export const DOC_VERSION = 2;

export const PAGE_MODES = Object.freeze({
  thermal: Object.freeze({
    id: "thermal",
    pageW: null,
    pageH: null,
    cols: 1,
    rows: 1
  }),
  a4: Object.freeze({
    id: "a4",
    pageW: 210,
    pageH: 297,
    cols: 4,
    rows: 6
  }),
  a3: Object.freeze({
    id: "a3",
    pageW: 297,
    pageH: 420,
    cols: 5,
    rows: 8
  })
});

export const ZOOM_STEPS = Object.freeze([0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8]);

export const RESIZE_HANDLES = Object.freeze([
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w"
]);

export const DEFAULT_STYLE = Object.freeze({
  borderWidth: 0,
  borderColor: "#0f172a",
  borderRadius: 0,
  bgColor: "#ffffff"
});

export const BRAND_DEFAULT = "AbouAmjad Store";
