import { roundMm } from "../core/units.js";
import { contentBox } from "./box.js";
import { migrateLayerToMm } from "./migrate.js";

/**
 * Physical horizontal flip for duplex / alternate labels.
 * newX = usableW − w − oldX; swap text-align left↔right.
 */
export function mirrorLayers(layers, spec) {
  const box = contentBox(spec);
  return (layers || []).map((ly) => {
    const copy = { ...migrateLayerToMm(ly, box) };
    copy.x = roundMm(Math.max(0, box.usableW - copy.w - copy.x));
    if (copy.align === "left") copy.align = "right";
    else if (copy.align === "right") copy.align = "left";
    const rot = Number(copy.rotation) || 0;
    if (rot) copy.rotation = (360 - rot) % 360;
    copy.unit = "mm";
    return copy;
  });
}
