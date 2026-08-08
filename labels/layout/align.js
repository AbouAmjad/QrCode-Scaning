import { roundMm } from "../core/units.js";

export function alignLayers(layers, mode, box) {
  if (!layers?.length) return layers;
  const xs = layers.map((l) => Number(l.x));
  const ys = layers.map((l) => Number(l.y));
  const rights = layers.map((l) => Number(l.x) + Number(l.w));
  const bottoms = layers.map((l) => Number(l.y) + Number(l.h));
  const minX = Math.min(...xs);
  const maxR = Math.max(...rights);
  const minY = Math.min(...ys);
  const maxB = Math.max(...bottoms);
  const cx = (minX + maxR) / 2;
  const cy = (minY + maxB) / 2;
  const usableW = box?.usableW ?? 50;
  const usableH = box?.usableH ?? 30;

  return layers.map((ly) => {
    const next = { ...ly };
    switch (mode) {
      case "left":
        next.x = minX;
        break;
      case "right":
        next.x = roundMm(maxR - Number(ly.w));
        break;
      case "top":
        next.y = minY;
        break;
      case "bottom":
        next.y = roundMm(maxB - Number(ly.h));
        break;
      case "centerH":
        next.x = roundMm(cx - Number(ly.w) / 2);
        break;
      case "centerV":
        next.y = roundMm(cy - Number(ly.h) / 2);
        break;
      case "centerLabelH":
        next.x = roundMm((usableW - Number(ly.w)) / 2);
        break;
      case "centerLabelV":
        next.y = roundMm((usableH - Number(ly.h)) / 2);
        break;
      default:
        break;
    }
    return next;
  });
}

export function distributeLayers(layers, axis = "h") {
  if (!layers || layers.length < 3) return layers;
  const sorted = [...layers].sort((a, b) =>
    axis === "h" ? Number(a.x) - Number(b.x) : Number(a.y) - Number(b.y)
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (axis === "h") {
    const start = Number(first.x);
    const end = Number(last.x);
    const step = (end - start) / (sorted.length - 1);
    return sorted.map((ly, i) => ({ ...ly, x: roundMm(start + step * i) }));
  }
  const start = Number(first.y);
  const end = Number(last.y);
  const step = (end - start) / (sorted.length - 1);
  return sorted.map((ly, i) => ({ ...ly, y: roundMm(start + step * i) }));
}
