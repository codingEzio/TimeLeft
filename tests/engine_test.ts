import { lifeTargetDate, validateProfile } from "../src/engine/profile.js";
import {
  INTERESTS,
  NEST_STACK,
  remainingWindow,
  snapshot,
} from "../src/engine/time.js";
import { LABELS } from "../src/engine/labels.ts";
import { normalizeUiLocale } from "../src/engine/locale.ts";

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}
function assert(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
Deno.test("actual extracted engine honors DST civil-day boundaries", () => {
  const profile = { birthDate: "2000-01-01", lifeHorizonAge: 80 };
  const spring = Date.parse("2026-03-08T12:00:00-07:00");
  const fall = Date.parse("2026-11-01T12:00:00-08:00");
  equal(
    snapshot(spring, profile, "America/Los_Angeles").find((r) => r.id === "day")
      ?.totalMs,
    23 * 60 * 60 * 1000,
  );
  equal(
    snapshot(fall, profile, "America/Los_Angeles").find((r) => r.id === "day")
      ?.totalMs,
    25 * 60 * 60 * 1000,
  );
});
Deno.test("actual extracted engine validates profiles and leap targets", () => {
  equal(validateProfile({ birthDate: "2025-02-29", lifeHorizonAge: 80 }), null);
  equal(validateProfile({ birthDate: "2000-02-29", lifeHorizonAge: 1 }), {
    birthDate: "2000-02-29",
    lifeHorizonAge: 1,
  });
  equal(lifeTargetDate({ birthDate: "2000-02-29", lifeHorizonAge: 1 }), {
    year: 2001,
    month: 2,
    day: 28,
    hour: 0,
    minute: 0,
    second: 0,
  });
  equal(lifeTargetDate({ birthDate: "2000-02-29", lifeHorizonAge: 4 }).day, 29);
  const life = snapshot(Date.parse("2026-01-01T00:00:00Z"), null, "UTC").find((
    r,
  ) => r.id === "life");
  assert(life?.unknown, "An absent lifespan must remain unknown");
  equal(remainingWindow(100, 200, 50).remainingMs, 100);
  equal(remainingWindow(100, 200, 250).remainingMs, 0);
});
Deno.test("snapshot retains the ten visible Life-to-Second ranges", () => {
  const visible = snapshot(Date.parse("2026-01-01T00:00:00Z"), null, "UTC")
    .filter((row) => NEST_STACK.includes(row.id)).map((row) => row.id);
  equal(visible, [
    "life",
    "year",
    "season",
    "month",
    "week",
    "day",
    "daypart",
    "hour",
    "minute",
    "second",
  ]);
});
Deno.test("labels resolve all three languages", () => {
  equal(normalizeUiLocale("zh-CN"), "zh-Hans");
  equal(normalizeUiLocale("zh-TW"), "zh-Hant");
  equal(normalizeUiLocale("en-US"), "en");
  equal(LABELS["zh-Hans"].interest.week, "本周");
  equal(LABELS["zh-Hant"].interest.week, "本週");
  for (const locale of ["en", "zh-Hant", "zh-Hans"] as const) {
    for (const id of NEST_STACK) {
      assert(LABELS[locale].interest[id], `${locale} lacks ${id}`);
    }
    for (const range of INTERESTS) {
      for (const unit of range.units) {
        assert(LABELS[locale].unit[unit], `${locale} lacks unit ${unit}`);
      }
    }
  }
});
