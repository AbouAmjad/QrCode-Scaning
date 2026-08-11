"use strict";

/**
 * Public wedding RSVP store (demo invitation).
 * File-backed so it stays isolated from custody tables.
 */
const fs = require("fs");
const path = require("path");

const STORE_FILE =
  process.env.WEDDING_RSVP_FILE ||
  "/var/www/toolcustody/assets/wedding/rsvp.json";

function emptyStore() {
  return { responses: [] };
}

function readStore() {
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.responses)) return emptyStore();
    return data;
  } catch (_) {
    return emptyStore();
  }
}

function writeStore(data) {
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  const tmp = STORE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, STORE_FILE);
}

function stats(store) {
  let acceptedPeople = 0;
  let acceptedParties = 0;
  let maybePeople = 0;
  let declinedPeople = 0;

  for (const row of store.responses) {
    const guests = Math.max(1, Number(row.guests) || 1);
    if (row.status === "yes") {
      acceptedParties += 1;
      acceptedPeople += guests;
    } else if (row.status === "maybe") {
      maybePeople += guests;
    } else {
      declinedPeople += guests;
    }
  }

  return {
    acceptedPeople,
    acceptedParties,
    maybePeople,
    declinedPeople,
    totalResponses: store.responses.length,
  };
}

async function weddingRsvpStats() {
  return { ok: true, ...stats(readStore()) };
}

async function weddingRsvpSubmit(ctx) {
  const params = (ctx && ctx.params) || {};
  const name = String(params.name || "").trim().slice(0, 80);
  const status = String(params.status || "yes").trim().toLowerCase();
  let guests = Number(params.guests);
  if (!Number.isFinite(guests)) guests = 1;
  guests = Math.min(8, Math.max(1, Math.round(guests)));

  if (!name) return { error: "NAME_REQUIRED" };
  if (!["yes", "maybe", "no"].includes(status)) return { error: "INVALID_STATUS" };

  const store = readStore();
  const key = name.toLowerCase();
  const idx = store.responses.findIndex((r) => String(r.name || "").toLowerCase() === key);
  const entry = {
    name,
    status,
    guests,
    at: new Date().toISOString(),
  };
  if (idx >= 0) store.responses[idx] = entry;
  else store.responses.push(entry);

  writeStore(store);
  return { ok: true, saved: entry, ...stats(store) };
}

module.exports = {
  weddingRsvpStats,
  weddingRsvpSubmit,
};
