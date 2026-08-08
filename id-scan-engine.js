/**
 * @deprecated Use modular id-scan/* via IdScanEngine facade.
 * Kept as a no-op shim so old SW caches do not 404.
 */
(function (global) {
  "use strict";
  if (!global.IdScanEngine) {
    console.warn("[IdScan] Load id-scan/*.js modules — id-scan-engine.js is deprecated.");
  }
})(typeof window !== "undefined" ? window : globalThis);
