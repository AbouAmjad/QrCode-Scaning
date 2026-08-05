/** Geofence helpers — pure functions, testable without DB. */

const EARTH_RADIUS_M = 6371000;

function toRad(deg) {
  return (Number(deg) * Math.PI) / 180;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const a1 = Number(lat1);
  const o1 = Number(lng1);
  const a2 = Number(lat2);
  const o2 = Number(lng2);
  if (![a1, o1, a2, o2].every(Number.isFinite)) return null;
  const dLat = toRad(a2 - a1);
  const dLng = toRad(o2 - o1);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a1)) * Math.cos(toRad(a2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(x)));
}

function insideGeofence(lat, lng, centerLat, centerLng, radiusM) {
  if (!Number.isFinite(Number(centerLat)) || !Number.isFinite(Number(centerLng))) {
    return { ok: true, skipped: true, distanceM: null };
  }
  const dist = haversineMeters(lat, lng, centerLat, centerLng);
  if (dist == null) return { ok: false, skipped: false, distanceM: null, reason: "INVALID_GPS" };
  const radius = Math.max(10, Number(radiusM) || 150);
  return {
    ok: dist <= radius,
    skipped: false,
    distanceM: Math.round(dist),
    reason: dist <= radius ? null : "OUTSIDE_GEOFENCE",
  };
}

module.exports = { haversineMeters, insideGeofence };
