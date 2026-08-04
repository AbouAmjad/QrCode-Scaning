/** Stable unique ids for layers / groups. */
let seq = 0;

export function createId(prefix = "ly") {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`;
}

export function resetIdSeqForTests() {
  seq = 0;
}
