import { motionPreferenceQuery } from "./motion-preference.ts";
import { normalizeUiLocale } from "./locale.ts";
import {
  amountInUnit,
  displayedMs,
  INTERESTS,
  NEST_STACK,
  snapshot,
} from "./time.js";
import { arrangeRanges } from "./geometry.js";
import { LABELS } from "./labels.ts";
export { LANGUAGES } from "./labels.ts";

export interface TimeCanvasOptions {
  birthDate: string | null;
  lifeHorizonAge: number;
  locale: string;
  layout: "contours" | "core";
  direction: "remaining" | "elapsed";
  units: Record<string, string>;
  enabledUnits?: Record<string, string[]>;
  onUnitChange?: (id: string, value: string) => void;
}
export const TIME_RANGES = NEST_STACK.map((id) => {
  const range = INTERESTS.find((range) => range.id === id)!;
  // Familiar clock units make the daily windows readable without configuration.
  const defaultUnit = id === "day"
    ? "hours"
    : id === "hour"
    ? "minutes"
    : range.units[0];
  return { id, units: [...range.units], defaultUnit };
});
export function rangeLabel(locale: string, id: string): string {
  return LABELS[normalizeUiLocale(locale)].interest[id] ?? id;
}
export function unitLabel(locale: string, id: string): string {
  return LABELS[normalizeUiLocale(locale)].unit[id] ?? id;
}

type Region = ReturnType<typeof arrangeRanges>[number] & {
  color: string;
  area: { x: number; y: number; width: number; height: number };
};
type Readout = {
  element: HTMLDivElement;
  name: HTMLSpanElement;
  select: HTMLSelectElement;
  temporalKey?: string;
  pickerActive?: boolean;
  availableWidth?: number;
  readoutSize?: number;
  nameFont?: string;
  valueFont?: string;
};

/** Owns only its child surface. The caller owns settings, profiles and persistence. */
export function mountTimeCanvas(host: HTMLElement, initial: TimeCanvasOptions) {
  let options = { ...initial };
  let disposed = false;
  let visible = true;
  let frame = 0;
  let timer = 0;
  let atlasKey = "";
  let width = 0, height = 0, dpr = 1;
  let regions: Region[] = [];
  let base: HTMLCanvasElement | null = null;
  let light: HTMLCanvasElement | null = null;
  let cachedSecond = -1;
  let cachedRows: ReturnType<typeof snapshot> = [];
  const formatters = new Map<string, Intl.NumberFormat>();
  const surface = document.createElement("div");
  surface.className = "time-canvas-surface";
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  surface.append(canvas);
  host.append(surface);
  const nodes = new Map<string, Readout>();
  for (const range of TIME_RANGES) {
    const element = document.createElement("div");
    element.className = "time-range-readout";
    element.dataset.range = range.id;
    const name = document.createElement("span");
    name.className = "time-range-name";
    const select = document.createElement("select");
    select.className = "time-range-value";
    const readout: Readout = { element, name, select };
    // Native pickers hold a tentative value before change. Clock paint must not
    // reset that value or replace option text while the browser owns selection.
    const beginPicking = () => {
      readout.pickerActive = true;
    };
    select.addEventListener("focus", beginPicking);
    select.addEventListener("pointerdown", beginPicking);
    select.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (readout.pickerActive) {
          event.stopPropagation();
          readout.pickerActive = false;
          // Let the native default action restore its selection before next paint.
        }
      } else if (event.key !== "Tab") beginPicking();
    });
    select.addEventListener("blur", () => {
      readout.pickerActive = false;
      paint();
    });
    select.addEventListener("change", () => {
      readout.pickerActive = false;
      options = {
        ...options,
        units: { ...options.units, [range.id]: select.value },
      };
      options.onUnitChange?.(range.id, select.value);
      paint();
    });
    element.append(name, select);
    surface.append(element);
    nodes.set(range.id, readout);
  }
  const reducedMotion = motionPreferenceQuery();
  const dark = matchMedia("(prefers-color-scheme: dark)");
  function releaseAtlas() {
    if (base) base.width = base.height = 0;
    if (light) light.width = light.height = 0;
    base = light = null;
    atlasKey = "";
    regions = [];
  }
  function rebuild() {
    const rect = surface.getBoundingClientRect();
    width = Math.floor(rect.width);
    height = Math.floor(rect.height);
    if (width < 1 || height < 1) return false;
    // Three surfaces share a bounded 12-million-pixel budget, even on Retina displays.
    dpr = Math.min(
      devicePixelRatio || 1,
      2,
      Math.sqrt(4_000_000 / (width * height)),
    );
    const style = getComputedStyle(surface);
    const ink = style.color;
    const paper = style.backgroundColor;
    const rule = style.getPropertyValue("--time-rule").trim() || ink;
    const accent = style.getPropertyValue("--time-live").trim() || ink;
    const corner = Number(style.getPropertyValue("--time-corner")) || 0;
    const key =
      `${width}:${height}:${dpr}:${options.layout}:${ink}:${paper}:${rule}:${accent}:${corner}`;
    if (key === atlasKey) return true;
    releaseAtlas();
    atlasKey = key;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    base = document.createElement("canvas");
    light = document.createElement("canvas");
    for (const layer of [base, light]) {
      layer.width = canvas.width;
      layer.height = canvas.height;
    }
    const ctx = base.getContext("2d")!;
    const lit = light.getContext("2d")!;
    ctx.scale(dpr, dpr);
    lit.scale(dpr, dpr);
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, width, height);
    regions = arrangeRanges(width, height, options.layout).map((r, index) => {
      const color = r.id === "second" ? accent : ink;
      ctx.beginPath();
      ctx.roundRect(
        r.x,
        r.y,
        r.width,
        r.height,
        Math.min(corner, r.height / 5),
      );
      ctx.fillStyle = paper;
      ctx.fill();
      ctx.fillStyle = ink;
      ctx.globalAlpha = .014 + index * .002;
      ctx.fill();
      ctx.strokeStyle = rule;
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      const header = Math.max(1, Math.min(38, r.band - 8));
      const node = nodes.get(r.id)!;
      Object.assign(node.element.style, {
        left: `${r.x + 12}px`,
        top: `${r.y + 3}px`,
        width: `${Math.max(1, r.width - 24)}px`,
        height: `${header}px`,
        color,
      });
      node.element.style.setProperty(
        "--time-readout-size",
        `${Math.max(1, Math.min(13, (header - 4) / 2.6))}px`,
      );
      node.availableWidth = Math.max(1, r.width - 24);
      node.name.style.removeProperty("font-size");
      node.select.style.removeProperty("font-size");
      node.temporalKey = undefined;
      delete node.element.dataset.fit;
      const area = {
        x: r.x + 16,
        y: r.y + header + 5,
        width: Math.max(1, r.width - 32),
        height: Math.max(3, r.band - header - 14),
      };
      const columns = Math.max(4, Math.min(144, Math.floor(area.width / 9)));
      const rows = Math.max(1, Math.min(96, Math.floor(area.height / 9)));
      const pitchX = area.width / columns, pitchY = area.height / rows;
      const radius = Math.max(
        .8,
        Math.min(2.6, (Math.min(pitchX, pitchY) - 2) / 2),
      );
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const x = area.x + (col + .5) * pitchX,
            y = area.y + (row + .5) * pitchY;
          ctx.fillStyle = ink;
          ctx.globalAlpha = .10;
          {
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
          }
          lit.fillStyle = ink;
          lit.globalAlpha = row % 4 === 0 ? .96 : .78;
          {
            lit.beginPath();
            lit.arc(x, y, radius, 0, Math.PI * 2);
            lit.fill();
          }
        }
      }
      ctx.globalAlpha = .22;
      ctx.fillStyle = color;
      for (let i = 0; i <= 10; i++) {
        ctx.fillRect(area.x + i * area.width / 10, area.y - 3, 1, 2);
      }
      ctx.globalAlpha = lit.globalAlpha = 1;
      return { ...r, color, area };
    });
    // Finish every geometry/style write before reading computed fonts. The
    // prior interleaving forced layout separately for each of ten readouts.
    for (const region of regions) {
      const node = nodes.get(region.id)!;
      node.readoutSize = parseFloat(getComputedStyle(node.element).fontSize);
      node.nameFont = getComputedStyle(node.name).font;
      node.valueFont = getComputedStyle(node.select).font;
    }
    return true;
  }
  function number(value: number, unit: string) {
    const digits = /^(milliseconds|nanoseconds)$/.test(unit)
      ? 0
      : unit === "years"
      ? 2
      : value >= 100
      ? 0
      : value >= 10
      ? 1
      : 2;
    const locale = normalizeUiLocale(options.locale),
      key = `${locale}:${digits}`;
    if (!formatters.has(key)) {
      formatters.set(
        key,
        new Intl.NumberFormat(locale, {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }),
      );
    }
    return formatters.get(key)!.format(value);
  }
  function paint() {
    if (disposed || document.hidden || !visible || !rebuild()) return;
    const now = Date.now(), second = Math.floor(now / 1000);
    if (cachedSecond !== second) {
      cachedRows = snapshot(now, {
        birthDate: options.birthDate,
        lifeHorizonAge: options.lifeHorizonAge,
      });
      cachedSecond = second;
    }
    const rows = Object.fromEntries(cachedRows.map((row) => [row.id, row]));
    // Second and minute boundaries remain precise without recomputing larger calendar windows each frame.
    for (const id of ["second", "minute"]) {
      const length = id === "second" ? 1000 : 60000;
      const progress = (now % length) / length;
      rows[id] = {
        ...rows[id],
        progress,
        ratio: 1 - progress,
        elapsedMs: now % length,
        remainingMs: length - now % length,
      };
    }
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(base!, 0, 0, width, height);
    for (const r of regions) {
      const row = rows[r.id], node = nodes.get(r.id)!;
      const range = TIME_RANGES.find((range) => range.id === r.id)!;
      const filtered = options.enabledUnits?.[r.id];
      const allowed = Array.isArray(filtered)
        ? range.units.filter((unit) => filtered.includes(unit))
        : range.units;
      // A malformed empty filter cannot leave a required scale without a valid unit.
      const units = allowed.length ? allowed : [range.units[0]];
      const unit = units.includes(options.units[r.id])
        ? options.units[r.id]
        : units.includes(range.defaultUnit)
        ? range.defaultUnit
        : units[0];
      const choicesKey = `${options.locale}:${units.join(",")}`;
      const name = rangeLabel(options.locale, r.id);
      if (node.name.textContent !== name) node.name.textContent = name;
      if (!node.pickerActive) {
        if (node.select.dataset.choices !== choicesKey) {
          node.select.replaceChildren(...units.map((value) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = unitLabel(options.locale, value);
            return option;
          }));
          node.select.dataset.choices = choicesKey;
        }
        const ariaLabel = `${name} · ${unitLabel(options.locale, unit)}`;
        if (node.select.getAttribute("aria-label") !== ariaLabel) {
          node.select.setAttribute("aria-label", ariaLabel);
        }
        const ms = displayedMs(row, options.direction);
        const temporalKey = `${choicesKey}:${row.unknown}:${ms}`;
        if (node.temporalKey !== temporalKey) {
          for (const option of node.select.options) {
            const value = row.unknown ? "—" : number(
              amountInUnit(ms, option.value),
              option.value,
            );
            const label = `${value} ${unitLabel(options.locale, option.value)}`;
            if (option.textContent !== label) option.textContent = label;
          }
          node.temporalKey = temporalKey;
        }
        if (node.select.value !== unit) node.select.value = unit;
        // Native selects otherwise clip long localized amounts to their box.
        // Fit actual current text, preserving every digit and unit. The canvas
        // context measures only when the displayed text or geometry changes.
        const selectedText = node.select.selectedOptions[0]?.textContent ?? "";
        // Tabular digits have equal advance: changing only their values does
        // not need another text measure during requestAnimationFrame paint.
        const fitKey = `${name}:${selectedText.replace(/[0-9]/g, "0")}`;
        if (node.element.dataset.fit !== fitKey) {
          const fit = (
            element: HTMLElement,
            content: string,
            font: string,
            reserve: number,
          ) => {
            ctx.font = font;
            const measured = ctx.measureText(content).width;
            const size = node.readoutSize! * Math.min(
              1,
              Math.max(1, node.availableWidth! - reserve) /
                Math.max(1, measured),
            );
            element.style.fontSize = `${size}px`;
          };
          fit(node.name, name, node.nameFont!, 4);
          fit(
            node.select,
            selectedText,
            node.valueFont!,
            24,
          );
          node.element.dataset.fit = fitKey;
        }
      }
      if (row.unknown) continue;
      const ratio = options.direction === "remaining"
        ? row.ratio
        : row.progress;
      const a = r.area, w = a.width * Math.max(0, Math.min(1, ratio));
      const x = options.direction === "remaining" ? a.x + a.width - w : a.x;
      ctx.globalAlpha = .76;
      if (w > 0) {
        ctx.drawImage(
          light!,
          x * dpr,
          a.y * dpr,
          w * dpr,
          a.height * dpr,
          x,
          a.y,
          w,
          a.height,
        );
      }
      const edge = Math.max(
        a.x,
        Math.min(
          a.x + a.width - 1,
          options.direction === "remaining" ? x : x + w,
        ),
      );
      ctx.fillStyle = r.color;
      ctx.globalAlpha = .10;
      ctx.fillRect(
        Math.max(a.x, edge - 3),
        a.y - 3,
        Math.min(7, a.x + a.width - Math.max(a.x, edge - 3)),
        a.height + 4,
      );
      ctx.globalAlpha = .95;
      ctx.fillRect(edge, a.y - 3, 1, a.height + 4);
      ctx.beginPath();
      ctx.moveTo(edge - 2, a.y - 5);
      ctx.lineTo(edge + 2, a.y - 5);
      ctx.lineTo(edge, a.y - 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function stop() {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    frame = timer = 0;
  }
  function tick() {
    frame = timer = 0;
    if (disposed || document.hidden || !visible) return;
    paint();
    if (reducedMotion.matches) {
      timer = globalThis.setTimeout(tick, 1000 - Date.now() % 1000);
    } else frame = requestAnimationFrame(tick);
  }
  function resume() {
    stop();
    if (document.hidden || !visible) {
      releaseAtlas();
      canvas.width = canvas.height = 0;
    } else frame = requestAnimationFrame(tick);
  }
  const resize = new ResizeObserver(([entry]) => {
    const size = entry.borderBoxSize?.[0];
    if (
      Math.floor(size?.inlineSize ?? entry.contentRect.width) === width &&
      Math.floor(size?.blockSize ?? entry.contentRect.height) === height
    ) return;
    resume();
  });
  resize.observe(surface);
  const intersection = new IntersectionObserver((entries) => {
    const next = entries[0]?.isIntersecting ?? false;
    if (next === visible) return;
    visible = next;
    resume();
  });
  intersection.observe(surface);
  const mutation = new MutationObserver(() => {
    atlasKey = "";
    resume();
  });
  mutation.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [
      "class",
      "style",
      "data-theme",
      "data-typography",
      "data-font",
      "data-font-ready",
      "data-ui-theme",
      "data-tone",
    ],
  });
  // A role face (e.g. the Doto readout) can arrive after the root font is
  // ready; refit readouts against the real metrics once any face loads.
  const fontsArrived = () => {
    atlasKey = "";
    resume();
  };
  document.fonts?.addEventListener?.("loadingdone", fontsArrived);
  document.addEventListener("visibilitychange", resume);
  reducedMotion.addEventListener("change", resume);
  dark.addEventListener("change", resume);
  tick();
  return {
    update(next: Partial<TimeCanvasOptions>) {
      if (disposed) return;
      if (
        Object.entries(next).every(([key, value]) =>
          options[key as keyof TimeCanvasOptions] === value
        )
      ) return;
      const geometryChanged =
        next.layout !== undefined && next.layout !== options.layout ||
        next.locale !== undefined && next.locale !== options.locale;
      options = { ...options, ...next };
      cachedSecond = -1;
      if (geometryChanged) atlasKey = "";
      resume();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      resize.disconnect();
      intersection.disconnect();
      mutation.disconnect();
      document.fonts?.removeEventListener?.("loadingdone", fontsArrived);
      document.removeEventListener("visibilitychange", resume);
      reducedMotion.removeEventListener("change", resume);
      dark.removeEventListener("change", resume);
      releaseAtlas();
      canvas.width = canvas.height = 0;
      cachedRows = [];
      formatters.clear();
      nodes.clear();
      surface.remove();
    },
  };
}
