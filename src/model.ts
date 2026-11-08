import { INTERESTS, NEST_STACK } from "./engine/time.js";

export type Language = "en" | "zh-Hant" | "zh-Hans";
export type Person = {
  id: string;
  name: string;
  birth: string;
  lifespan: number | null;
  source: "unknown" | "owner" | "estimate";
  tentative: boolean;
};
export type Display = {
  layout: "contours" | "core";
  direction: "remaining" | "elapsed";
  units: Record<string, string>;
  enabledUnits: Record<string, string[]>;
};
export type State = {
  version: 1;
  revision: number;
  people: Person[];
  selected: string;
  display: Display;
  theme: "system" | "light" | "dark";
  font: "system" | "pixel";
  language: Language;
  legacy: Record<string, unknown>;
};
export const key = "timeleft.state.v1";
export const empty = (language: Language = "en"): State => ({
  version: 1,
  revision: 0,
  people: [],
  selected: "",
  display: {
    layout: "contours",
    direction: "remaining",
    units: {},
    enabledUnits: {},
  },
  theme: "system",
  font: "system",
  language,
  legacy: {},
});
const obj = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const ranges = new Map<string, readonly string[]>(
  INTERESTS.filter((x) => NEST_STACK.includes(x.id)).map(
    (x) => [x.id, x.units],
  ),
);
const idValid = (s: unknown): s is string =>
  typeof s === "string" && s.length > 0 && s.length <= 160;
export function validBirth(value: unknown): value is string {
  if (value === "") return true;
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value);
  if (!match) return false;
  const y = +match[1],
    m = +match[2],
    d = +(match[3] ?? "1"),
    date = new Date(0);
  date.setUTCFullYear(y, m - 1, d);
  date.setUTCHours(0, 0, 0, 0);
  return y >= 1 && date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
export function validDisplay(value: unknown): value is Display {
  if (
    !obj(value) || !["contours", "core"].includes(String(value.layout)) ||
    !["remaining", "elapsed"].includes(String(value.direction)) ||
    !obj(value.units) || !obj(value.enabledUnits)
  ) return false;
  if (
    !Object.entries(value.units).every(([k, v]) =>
      typeof v === "string" && ranges.get(k)?.includes(v)
    )
  ) return false;
  if (
    !Object.entries(value.enabledUnits).every(([k, v]) =>
      Array.isArray(v) && v.length <= 32 && new Set(v).size === v.length &&
      v.every((item) =>
        typeof item === "string" && ranges.get(k)?.includes(item)
      )
    )
  ) return false;
  return true;
}
export function validState(value: unknown): value is State {
  if (
    !obj(value) || value.version !== 1 ||
    !Number.isSafeInteger(value.revision) || (value.revision as number) < 0 ||
    !Array.isArray(value.people) || value.people.length > 1000 ||
    typeof value.selected !== "string" || !validDisplay(value.display) ||
    !["system", "light", "dark"].includes(String(value.theme)) ||
    !["system", "pixel"].includes(String(value.font)) ||
    !["en", "zh-Hant", "zh-Hans"].includes(String(value.language)) ||
    !obj(value.legacy)
  ) return false;
  const ids = new Set<string>();
  for (const p of value.people) {
    if (
      !obj(p) || !idValid(p.id) || ids.has(p.id) ||
      typeof p.name !== "string" || !p.name.trim() || p.name.length > 200 ||
      !validBirth(p.birth) ||
      !(p.lifespan === null ||
        (Number.isInteger(p.lifespan) && Number(p.lifespan) >= 1 &&
          Number(p.lifespan) <= 200)) ||
      !["unknown", "owner", "estimate"].includes(String(p.source)) ||
      typeof p.tentative !== "boolean"
    ) return false;
    ids.add(p.id);
  }
  return value.people.length ? ids.has(value.selected) : value.selected === "";
}
export type Storage = Pick<StorageArea, "getItem" | "setItem">;
type StorageArea = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};
/** Reject a concurrent change before the write and require exact readback. */
export function persist(
  storage: Storage,
  expected: string | null,
  next: State,
): string {
  if (!validState(next)) throw Error("invalid_state");
  if (storage.getItem(key) !== expected) throw Error("storage_conflict");
  const data = JSON.stringify(next);
  storage.setItem(key, data);
  let readback: string | null;
  try {
    readback = storage.getItem(key);
  } catch {
    throw Error("readback_failed");
  }
  if (readback !== data) throw Error("readback_failed");
  return data;
}
export type ImportPlan = {
  state: State;
  added: number;
  skipped: number;
  displayImported: boolean;
  legacyPreserved: boolean;
  replace: boolean;
};
/** Parse a user-chosen backup or Prometheus configuration without touching storage. */
export function planImport(input: unknown, current: State): ImportPlan {
  if (validState(input)) {
    return {
      state: { ...input, revision: current.revision + 1 },
      added: input.people.length,
      skipped: 0,
      displayImported: true,
      legacyPreserved: Object.keys(input.legacy).length > 0,
      replace: true,
    };
  }
  if (!obj(input)) throw Error("unsupported_file");
  const items = Array.isArray(input.items) ? input.items : [];
  if (
    items.some((x) => !obj(x) || typeof x.key !== "string") ||
    new Set(items.map((x) => (x as Record<string, unknown>).key)).size !==
      items.length
  ) throw Error("invalid_items");
  const item = (name: string) =>
    items.find((x) => (x as Record<string, unknown>).key === name)?.value;
  let family: unknown = item("family.lifeCountdown") ??
    input["family.lifeCountdown"];
  if (family === undefined && obj(input.members)) family = input;
  if (typeof family === "string" && family !== "") family = JSON.parse(family);
  const names: Record<string, string> = current.language === "zh-Hant"
    ? { self: "自己", mother: "母親", father: "父親", brother: "兄弟" }
    : current.language === "zh-Hans"
    ? { self: "自己", mother: "母亲", father: "父亲", brother: "兄弟" }
    : { self: "Me", mother: "Mother", father: "Father", brother: "Brother" };
  const people: Person[] = [];
  if (family !== undefined && family !== "") {
    if (
      !obj(family) || family.version !== 1 || !obj(family.members) ||
      Object.keys(family.members).sort().join(",") !==
        Object.keys(names).sort().join(",")
    ) throw Error("invalid_family");
    for (const [id, name] of Object.entries(names)) {
      const m = family.members[id];
      if (
        !obj(m) ||
        !(m.birthDate === null ||
          (m.birthDate !== "" && validBirth(m.birthDate))) ||
        !(m.lifespanYears === null ||
          (Number.isInteger(m.lifespanYears) && Number(m.lifespanYears) >= 1 &&
            Number(m.lifespanYears) <= 150)) ||
        !["unknown", "owner", "estimate"].includes(String(m.source)) ||
        typeof m.tentative !== "boolean"
      ) throw Error("invalid_family");
      people.push({
        id: `prometheus-family-${id}`,
        name,
        birth: m.birthDate === null ? "" : m.birthDate as string,
        lifespan: m.lifespanYears as number | null,
        source: m.source as Person["source"],
        tentative: m.tentative,
      });
    }
  }
  const legacyProfile = item("time.lifeProfile");
  if (legacyProfile !== undefined && legacyProfile !== null) {
    if (
      !obj(legacyProfile) || !validBirth(legacyProfile.birthDate) ||
      !legacyProfile.birthDate ||
      !Number.isInteger(legacyProfile.lifeHorizonAge) ||
      Number(legacyProfile.lifeHorizonAge) < 1 ||
      Number(legacyProfile.lifeHorizonAge) > 200
    ) throw Error("invalid_legacy_profile");
    people.push({
      id: "prometheus-legacy-life",
      name: current.language === "zh-Hant"
        ? "舊個人資料"
        : current.language === "zh-Hans"
        ? "旧个人资料"
        : "Legacy profile",
      birth: legacyProfile.birthDate,
      lifespan: legacyProfile.lifeHorizonAge as number,
      source: "owner",
      tentative: false,
    });
  }
  const duplicate =
    people.filter((p) =>
      current.people.some((existing) => existing.id === p.id)
    ).length;
  const additions = people.filter((p) =>
    !current.people.some((existing) => existing.id === p.id)
  );
  if (current.people.length + additions.length > 1000) throw Error("capacity");
  const explicitDisplay = item("time.display");
  const oldDisplay = item("time.preferences");
  const oldPlayground = item("hourglass.playground");
  let display = current.display;
  if (explicitDisplay !== undefined && explicitDisplay !== null) {
    if (!validDisplay(explicitDisplay)) throw Error("invalid_display");
    display = explicitDisplay;
  } else if (oldDisplay !== undefined && oldDisplay !== null) {
    if (!obj(oldDisplay)) throw Error("invalid_display");
    const converted = {
      layout: oldDisplay.presentation,
      direction: oldDisplay.direction,
      units: oldDisplay.units,
      enabledUnits: {},
    };
    if (!validDisplay(converted)) throw Error("invalid_display");
    display = converted;
  }
  const legacy = { ...current.legacy };
  if (family !== undefined && family !== "") {
    legacy["family.lifeCountdown"] = family;
  }
  if (oldDisplay !== undefined && oldDisplay !== null) {
    legacy["time.preferences"] = oldDisplay;
  }
  if (legacyProfile !== undefined && legacyProfile !== null) {
    legacy["time.lifeProfile"] = legacyProfile;
  }
  if (oldPlayground !== undefined && oldPlayground !== null) {
    legacy["hourglass.playground"] = oldPlayground;
  }
  if (
    !people.length &&
    (explicitDisplay === undefined || explicitDisplay === null) &&
    (oldDisplay === undefined || oldDisplay === null) &&
    (oldPlayground === undefined || oldPlayground === null)
  ) throw Error("unsupported_file");
  const result: State = {
    ...current,
    revision: current.revision + 1,
    people: [...current.people, ...additions],
    selected: current.selected || additions[0]?.id || "",
    display,
    legacy,
  };
  if (!validState(result)) throw Error("invalid_state");
  return {
    state: result,
    added: additions.length,
    skipped: duplicate,
    displayImported:
      (explicitDisplay !== undefined && explicitDisplay !== null) ||
      (oldDisplay !== undefined && oldDisplay !== null),
    legacyPreserved: Object.keys(legacy).length > 0,
    replace: false,
  };
}
