import { roundMm } from "../core/units.js";

export function snapMm(n, gridMm) {
  const g = Number(gridMm) || 0;
  if (g <= 0) return roundMm(n);
  return roundMm(Math.round(Number(n) / g) * g);
}

/**
 * Snap proposed position against grid + other objects.
 * Returns { x, y, guides: [{axis,value}] }.
 */
export function snapPosition(x, y, w, h, box, others = [], opts = {}) {
  const gridMm = opts.gridMm ?? 1;
  const snapToGrid = opts.snapToGrid !== false;
  const snapToObjects = opts.snapToObjects !== false;
  const threshold = Math.max(0.15, gridMm * 0.35);
  const guides = [];
  let nx = x;
  let ny = y;

  if (snapToGrid && gridMm > 0) {
    nx = snapMm(nx, gridMm);
    ny = snapMm(ny, gridMm);
  }

  if (snapToObjects) {
    const targetsX = [0, box.usableW / 2, box.usableW];
    const targetsY = [0, box.usableH / 2, box.usableH];
    for (const o of others) {
      targetsX.push(Number(o.x), Number(o.x) + Number(o.w) / 2, Number(o.x) + Number(o.w));
      targetsY.push(Number(o.y), Number(o.y) + Number(o.h) / 2, Number(o.y) + Number(o.h));
    }
    let snappedX = false;
    let snappedY = false;
    for (const c of [nx, nx + w / 2, nx + w]) {
      if (snappedX) break;
      for (const t of targetsX) {
        if (Math.abs(c - t) <= threshold) {
          nx += t - c;
          guides.push({ axis: "x", value: roundMm(t) });
          snappedX = true;
          break;
        }
      }
    }
    for (const c of [ny, ny + h / 2, ny + h]) {
      if (snappedY) break;
      for (const t of targetsY) {
        if (Math.abs(c - t) <= threshold) {
          ny += t - c;
          guides.push({ axis: "y", value: roundMm(t) });
          snappedY = true;
          break;
        }
      }
    }
  }

  return { x: roundMm(nx), y: roundMm(ny), guides };
}
