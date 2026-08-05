/** Errors thrown by handlers are turned into `{ error: code }` JSON bodies. */
class ApiError extends Error {
  constructor(code, extra) {
    super(code);
    this.code = code;
    this.extra = extra || null;
  }

  toJSON() {
    return { error: this.code, success: false, ...(this.extra || {}) };
  }
}

function fail(code, extra) {
  throw new ApiError(code, extra);
}

module.exports = { ApiError, fail };
