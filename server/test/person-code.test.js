/**
 * Node tests for person code gap-fill (no DB).
 * Run: node server/test/person-code.test.js
 */
const { nextAvailablePersonCode } = require("../src/handlers/people");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL", msg);
    process.exitCode = 1;
  } else {
    console.log("ok ", msg);
  }
}

assert(nextAvailablePersonCode([]).code === "P101", "empty → P101");
// High series (≥100 majority): search gaps from 100 upward
assert(nextAvailablePersonCode(["P101", "P104"]).code === "P100", "fills P100 before P102");
assert(nextAvailablePersonCode(["P100", "P101", "P104"]).code === "P102", "fills P102 gap");
assert(nextAvailablePersonCode(["P100", "P101", "P102", "P104"]).code === "P103", "fills P103 gap");
assert(nextAvailablePersonCode(["P100", "P101", "P102", "P103"]).code === "P104", "no gap → max+1");
// Majority 100+ with lone P001 → still search from 100
assert(nextAvailablePersonCode(["P001", "P101", "P103", "P104"]).code === "P100", "series from 100");
assert(nextAvailablePersonCode(["P1", "P2", "P4"]).code === "P3", "low series fills P3");

console.log(process.exitCode ? "FAILED" : "ALL PASSED");
