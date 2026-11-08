// Contours and core geometry adapted from code by codingEzio.
import { NEST_STACK } from "./time.js";

// Spatial choices only; time boundaries and conversion rules remain in time.js.
// Short/wide windows unfold the contour stack rather than shrinking ten labels.
const GEOMETRY = Object.freeze({
  gap: 12,
  inset: 5,
  minColumn: 135,
  shortHeight: 440,
});

function nested(ids, bounds, output) {
  const { x, y, width, height } = bounds;
  const inset = Math.min(GEOMETRY.inset, width / 70);
  const minimumCore = Math.min(240, Math.max(38, height * 0.2));
  const weight = ids.slice(0, -1).reduce(
    (sum, id) => sum + (NEST_STACK.indexOf(id) >= 6 ? 1.2 : 1),
    0,
  );
  const band = Math.min(
    Math.max(66, Math.min(140, height / 12)),
    (height - minimumCore) / Math.max(1, weight),
  );
  let top = y;
  ids.forEach((id, index) => {
    const last = index === ids.length - 1;
    const step = band * (NEST_STACK.indexOf(id) >= 6 ? 1.2 : 1);
    output.push({
      id,
      x: x + index * inset,
      y: top,
      width: width - index * inset * 2,
      height: height - (top - y) - index * inset,
      band: last ? height - (top - y) - index * inset : step,
      nested: true,
    });
    top += step;
  });
}

export function arrangeRanges(width, height, mode) {
  const output = [];
  const margin = 3;
  const box = {
    x: margin,
    y: margin,
    width: width - margin * 2,
    height: height - margin * 2,
  };
  const gap = GEOMETRY.gap;
  if (mode === "core" && width >= 260 && (height >= 360 || width >= 600)) {
    const portrait = width < 600 || width / height < 1.05;
    const context = portrait
      ? { ...box, height: Math.min(height * 0.34, 250) }
      : { ...box, width: Math.max(200, Math.min(width * 0.32, 420)) };
    const columns = portrait || height < 400 ? 2 : 1;
    const rows = 6 / columns;
    NEST_STACK.slice(0, 6).forEach((id, index) => {
      const w = (context.width - gap * (columns - 1)) / columns;
      const h = (context.height - gap * (rows - 1)) / rows;
      output.push({
        id,
        x: context.x + (index % columns) * (w + gap),
        y: context.y + Math.floor(index / columns) * (h + gap),
        width: w,
        height: h,
        band: h,
        nested: false,
      });
    });
    const core = portrait
      ? {
        ...box,
        y: box.y + context.height + gap,
        height: box.height - context.height - gap,
      }
      : {
        ...box,
        x: box.x + context.width + gap,
        width: box.width - context.width - gap,
      };
    nested(NEST_STACK.slice(6), core, output);
  } else {
    const capacity = Math.max(1, Math.floor(width / GEOMETRY.minColumn));
    const columns = Math.min(
      3,
      capacity,
      height < GEOMETRY.shortHeight
        ? Math.ceil(550 / height)
        : width / height > 2.3
        ? 2
        : 1,
    );
    let start = 0;
    for (let col = 0; col < columns; col++) {
      const count = Math.ceil((10 - start) / (columns - col));
      const w = (box.width - gap * (columns - 1)) / columns;
      nested(NEST_STACK.slice(start, start + count), {
        ...box,
        x: box.x + col * (w + gap),
        width: w,
      }, output);
      start += count;
    }
  }
  // Compact embedded viewports must fit ten readout rows; do not overlap headers.
  if (output.some((region) => region.band < 48 || region.width < 210)) {
    // Pick the grid with the most room for complete two-line readouts. This
    // also unfolds very tall/narrow or shallow/wide contours before they clip.
    let columns = 1;
    let room = 0;
    for (let candidate = 1; candidate <= NEST_STACK.length; candidate++) {
      const rows = Math.ceil(NEST_STACK.length / candidate);
      const cellWidth = (box.width - 5 * (candidate - 1)) / candidate;
      const cellHeight = (box.height - 5 * (rows - 1)) / rows;
      const score = Math.min(cellWidth / 220, cellHeight / 60);
      if (score > room) {
        columns = candidate;
        room = score;
      }
    }
    const rows = Math.ceil(NEST_STACK.length / columns);
    const compactGap = 5;
    return NEST_STACK.map((id, index) => {
      const w = (box.width - compactGap * (columns - 1)) / columns;
      const h = (box.height - compactGap * (rows - 1)) / rows;
      return {
        id,
        x: box.x + (index % columns) * (w + compactGap),
        y: box.y + Math.floor(index / columns) * (h + compactGap),
        width: w,
        height: h,
        band: h,
        nested: false,
      };
    });
  }
  return output;
}
