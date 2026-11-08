// Calendar arithmetic adapted from code by codingEzio; missing Life is explicitly unknown.
import { lifeTargetDate, validateProfile } from "./profile.js";

export const SETTINGS = Object.freeze({
  pomodoroSeconds: 1500,
  workStartHour: 8,
  workEndHour: 19,
});

export const MODES = Object.freeze(["countdown", "progress", "depletion"]);

export const DEMO_RULES = Object.freeze({
  daypartSplitHour: 12,
  seasonMonths: Object.freeze([3, 6, 9, 12]),
  excludeWorkHolidays: false,
});

export const INTERESTS = Object.freeze([
  Object.freeze({
    id: "life",
    range: "life_horizon",
    units: Object.freeze([
      "years",
      "seasons",
      "months",
      "weeks",
      "days",
      "hours",
      "pomodoros",
      "minutes",
      "seconds",
      "milliseconds",
      "nanoseconds",
    ]),
  }),
  Object.freeze({
    id: "year",
    range: "current_year",
    units: Object.freeze([
      "seasons",
      "months",
      "weeks",
      "days",
      "hours",
      "pomodoros",
      "minutes",
      "seconds",
    ]),
  }),
  Object.freeze({
    id: "season",
    range: "current_season",
    units: Object.freeze([
      "months",
      "weeks",
      "days",
      "hours",
      "pomodoros",
      "minutes",
      "seconds",
    ]),
  }),
  Object.freeze({
    id: "month",
    range: "current_month",
    units: Object.freeze([
      "weeks",
      "days",
      "hours",
      "pomodoros",
      "minutes",
      "seconds",
    ]),
  }),
  Object.freeze({
    id: "week",
    range: "current_week",
    units: Object.freeze([
      "days",
      "dayparts",
      "work_windows",
      "hours",
      "pomodoros",
      "minutes",
      "seconds",
    ]),
  }),
  Object.freeze({
    id: "day",
    range: "current_day",
    units: Object.freeze([
      "dayparts",
      "work_windows",
      "hours",
      "pomodoros",
      "minutes",
      "seconds",
    ]),
  }),
  Object.freeze({
    id: "work",
    range: "active_work_window",
    units: Object.freeze(["hours", "pomodoros", "minutes", "seconds"]),
  }),
  Object.freeze({
    id: "off",
    range: "outside_work_window",
    units: Object.freeze(["hours", "pomodoros", "minutes", "seconds"]),
  }),
  Object.freeze({
    id: "daypart",
    range: "current_daypart",
    units: Object.freeze(["hours", "pomodoros", "minutes", "seconds"]),
  }),
  Object.freeze({
    id: "hour",
    range: "current_hour",
    units: Object.freeze(["pomodoros", "minutes", "seconds"]),
  }),
  Object.freeze({
    id: "minute",
    range: "current_minute",
    units: Object.freeze(["seconds", "milliseconds", "nanoseconds"]),
  }),
  Object.freeze({
    id: "second",
    range: "current_second",
    units: Object.freeze(["milliseconds", "nanoseconds"]),
  }),
]);

export const NEST_STACK = Object.freeze([
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

export const HIDDEN_INTERESTS = Object.freeze(["work", "off"]);

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const YEAR_MS = 365.2425 * DAY_MS;

export const UNIT_MS = Object.freeze({
  nanoseconds: 0.000001,
  milliseconds: 1,
  seconds: 1000,
  minutes: MINUTE_MS,
  hours: HOUR_MS,
  pomodoros: SETTINGS.pomodoroSeconds * 1000,
  work_windows: (SETTINGS.workEndHour - SETTINGS.workStartHour) * HOUR_MS,
  dayparts: DEMO_RULES.daypartSplitHour * HOUR_MS,
  days: DAY_MS,
  weeks: 7 * DAY_MS,
  months: YEAR_MS / 12,
  seasons: YEAR_MS / 4,
  years: YEAR_MS,
});

const INTEREST_BY_ID = Object.fromEntries(
  INTERESTS.map((interest) => [interest.id, interest]),
);

const zoneFormats = new Map();
export function zonedParts(
  instant,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  if (!zoneFormats.has(timeZone)) {
    zoneFormats.set(
      timeZone,
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }),
    );
  }
  const parts = zoneFormats.get(timeZone).formatToParts(new Date(instant));
  const values = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function utcParts(parts) {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
    parts.millisecond ?? 0,
  );
  return date.getTime();
}

export function instantFromZoned(
  parts,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  const wall = utcParts(parts);
  let guess = wall;
  const seen = [];
  for (let i = 0; i < 4; i++) {
    const offset = utcParts(zonedParts(guess, timeZone)) -
      Math.floor(guess / 1000) * 1000;
    const next = wall - offset;
    if (next === guess) return next;
    if (seen.includes(next)) return Math.max(guess, next); // skipped local time: move forward
    seen.push(guess);
    guess = next;
  }
  return guess;
}

export function remainingWindow(startMs, endMs, nowMs) {
  const totalMs = endMs - startMs;
  if (!(totalMs > 0)) {
    return {
      startMs,
      endMs,
      totalMs,
      remainingMs: 0,
      elapsedMs: 0,
      ratio: 0,
      progress: 0,
    };
  }
  const remainingMs = Math.min(Math.max(endMs - nowMs, 0), totalMs);
  const elapsedMs = totalMs - remainingMs;
  return {
    startMs,
    endMs,
    totalMs,
    remainingMs,
    elapsedMs,
    ratio: remainingMs / totalMs,
    progress: elapsedMs / totalMs,
  };
}

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`invalid date ${value}`);
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: 0,
    minute: 0,
    second: 0,
  };
}

function makeClock(profile, timeZone) {
  const zonedParts = (instant) => globalZonedParts(instant, timeZone);
  const instantFromZoned = (parts) => globalInstantFromZoned(parts, timeZone);
  function midnight(parts) {
    return instantFromZoned({
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: 0,
      minute: 0,
      second: 0,
    });
  }

  function addMonths(year, month, count) {
    const next = month + count;
    return {
      year: year + Math.floor((next - 1) / 12),
      month: ((next - 1) % 12) + 1,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
    };
  }

  function lifeHorizonRange() {
    if (!validateProfile(profile)) return { startMs: NaN, endMs: NaN };
    return {
      startMs: instantFromZoned(parseDate(profile.birthDate)),
      endMs: instantFromZoned(lifeTargetDate(profile)),
    };
  }

  function currentYearRange(nowMs) {
    const parts = zonedParts(nowMs);
    return {
      startMs: instantFromZoned({
        year: parts.year,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
      }),
      endMs: instantFromZoned({
        year: parts.year + 1,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
      }),
    };
  }

  function currentSeasonRange(nowMs) {
    const parts = zonedParts(nowMs);
    let startYear = parts.year;
    let startMonth = 12;
    for (const month of DEMO_RULES.seasonMonths) {
      if (parts.month >= month) startMonth = month;
    }
    if (parts.month < 3) startYear -= 1;
    const start = {
      year: startYear,
      month: startMonth,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
    };
    const end = startMonth === 12
      ? { year: startYear + 1, month: 3, day: 1, hour: 0, minute: 0, second: 0 }
      : addMonths(startYear, startMonth, 3);
    return {
      startMs: instantFromZoned(start),
      endMs: instantFromZoned(end),
    };
  }

  function currentMonthRange(nowMs) {
    const parts = zonedParts(nowMs);
    return {
      startMs: instantFromZoned({
        year: parts.year,
        month: parts.month,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
      }),
      endMs: instantFromZoned(addMonths(parts.year, parts.month, 1)),
    };
  }

  function currentWeekRange(nowMs) {
    const parts = zonedParts(nowMs);
    const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
      .getUTCDay();
    const mondayOffset = (weekday + 6) % 7;
    return {
      startMs: instantFromZoned({
        ...parts,
        day: parts.day - mondayOffset,
        hour: 0,
        minute: 0,
        second: 0,
      }),
      endMs: instantFromZoned({
        ...parts,
        day: parts.day - mondayOffset + 7,
        hour: 0,
        minute: 0,
        second: 0,
      }),
    };
  }

  function currentDayRange(nowMs) {
    const parts = zonedParts(nowMs);
    return {
      startMs: midnight(parts),
      endMs: midnight({ ...parts, day: parts.day + 1 }),
    };
  }

  function currentDaypartRange(nowMs) {
    const parts = zonedParts(nowMs);
    const split = instantFromZoned({
      ...parts,
      hour: DEMO_RULES.daypartSplitHour,
      minute: 0,
      second: 0,
    });
    return parts.hour < DEMO_RULES.daypartSplitHour
      ? { startMs: midnight(parts), endMs: split }
      : { startMs: split, endMs: midnight({ ...parts, day: parts.day + 1 }) };
  }

  function currentHourRange(nowMs) {
    const parts = zonedParts(nowMs);
    // Subtract within the actual occurrence, including a repeated DST hour.
    const startMs = nowMs - parts.minute * MINUTE_MS - parts.second * 1000 -
      ((nowMs % 1000 + 1000) % 1000);
    return { startMs, endMs: startMs + HOUR_MS };
  }

  function currentMinuteRange(nowMs) {
    const startMs = Math.floor(nowMs / MINUTE_MS) * MINUTE_MS;
    return { startMs, endMs: startMs + MINUTE_MS };
  }

  function currentSecondRange(nowMs) {
    const startMs = nowMs - (nowMs % 1000);
    return { startMs, endMs: startMs + 1000 };
  }

  function atHour(parts, hour, dayOffset = 0) {
    return instantFromZoned({
      ...parts,
      day: parts.day + dayOffset,
      hour,
      minute: 0,
      second: 0,
    });
  }
  function workWindowRange(nowMs) {
    const parts = zonedParts(nowMs);
    return {
      startMs: atHour(parts, SETTINGS.workStartHour),
      endMs: atHour(parts, SETTINGS.workEndHour),
    };
  }
  function outsideWorkRange(nowMs) {
    const parts = zonedParts(nowMs);
    const morningEnd = atHour(parts, SETTINGS.workStartHour);
    return nowMs < morningEnd
      ? { startMs: atHour(parts, SETTINGS.workEndHour, -1), endMs: morningEnd }
      : {
        startMs: atHour(parts, SETTINGS.workEndHour),
        endMs: atHour(parts, SETTINGS.workStartHour, 1),
      };
  }

  const RANGE_OF = {
    life: lifeHorizonRange,
    year: currentYearRange,
    season: currentSeasonRange,
    month: currentMonthRange,
    week: currentWeekRange,
    day: currentDayRange,
    work: workWindowRange,
    off: outsideWorkRange,
    daypart: currentDaypartRange,
    hour: currentHourRange,
    minute: currentMinuteRange,
    second: currentSecondRange,
  };

  return (nowMs) => {
    return INTERESTS.map((interest) => {
      const range = RANGE_OF[interest.id](nowMs);
      return {
        id: interest.id,
        range: interest.range,
        units: interest.units,
        unknown: !Number.isFinite(range.startMs),
        ...remainingWindow(range.startMs, range.endMs, nowMs),
      };
    });
  };
}
const globalZonedParts = zonedParts;
const globalInstantFromZoned = instantFromZoned;
export function snapshot(
  nowMs = Date.now(),
  profile,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  return makeClock(profile, timeZone)(nowMs);
}

export function amountInUnit(ms, unit) {
  const size = UNIT_MS[unit];
  if (!size) throw new Error(`unknown unit ${unit}`);
  return ms / size;
}

export function displayedMs(row, direction) {
  return direction === "elapsed" ? row.elapsedMs : row.remainingMs;
}

export function usedRatio(row) {
  return row.progress;
}

export function parseDirection(value) {
  return value === "elapsed" ? "elapsed" : "remaining";
}

export function nextDirection(direction) {
  return direction === "remaining" ? "elapsed" : "remaining";
}

export function nextMode(mode) {
  const index = MODES.indexOf(mode);
  return MODES[(index < 0 ? 0 : index + 1) % MODES.length];
}

export function nextUnit(interestId, unit) {
  const interest = INTEREST_BY_ID[interestId];
  if (!interest) throw new Error(`unknown interest ${interestId}`);
  const index = interest.units.indexOf(unit);
  return interest.units[(index < 0 ? 0 : index + 1) % interest.units.length];
}

export function defaultUnit(interestId) {
  return INTEREST_BY_ID[interestId].units[0];
}

export function remainingLayers(nowMs = Date.now()) {
  return snapshot(nowMs);
}
