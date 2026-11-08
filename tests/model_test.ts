import {
  empty,
  key,
  persist,
  type Person,
  planImport,
  type State,
  validBirth,
  validState,
} from "../src/model.ts";
function assert(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
function equal(actual: unknown, expected: unknown) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}
const family = {
  version: 1,
  members: {
    self: {
      birthDate: "1990-03",
      lifespanYears: 88,
      source: "estimate",
      tentative: true,
    },
    mother: {
      birthDate: null,
      lifespanYears: null,
      source: "unknown",
      tentative: false,
    },
    father: {
      birthDate: "1980-02-29",
      lifespanYears: 80,
      source: "owner",
      tentative: false,
    },
    brother: {
      birthDate: null,
      lifespanYears: null,
      source: "unknown",
      tentative: false,
    },
  },
  visibleMembers: ["self", "mother"],
};
const display = {
  layout: "core",
  direction: "elapsed",
  units: { life: "days", second: "milliseconds" },
  enabledUnits: { life: ["years", "days"] },
};
Deno.test("Prometheus export imports exact dates, estimate flags and display; repeat leaves manual people intact", () => {
  const source = {
    format: "prometheus-configuration",
    version: 1,
    items: [{ key: "family.lifeCountdown", value: JSON.stringify(family) }, {
      key: "time.display",
      value: display,
    }, {
      key: "time.preferences",
      value: {
        presentation: "contours",
        direction: "remaining",
        fill: "solid",
        units: { life: "years" },
      },
    }],
  };
  const first = planImport(source, empty("zh-Hans"));
  assert(validState(first.state), "state validation");
  equal(first.added, 4);
  equal(first.state.people[0].name, "自己");
  equal(first.state.people[0].birth, "1990-03");
  equal(first.state.people[0].source, "estimate");
  equal(first.state.people[0].tentative, true);
  equal(first.state.people[1].lifespan, null);
  equal(first.state.display, display);
  equal(first.state.legacy["family.lifeCountdown"], family);
  const edited: State = {
    ...first.state,
    people: first.state.people.map((p, i) =>
      i === 0 ? { ...p, name: "Manual choice", birth: "1992-01-02" } : p
    ),
  };
  const again = planImport(source, edited);
  equal(again.added, 0);
  equal(again.skipped, 4);
  equal(again.state.people[0].name, "Manual choice");
  equal(again.state.people[0].birth, "1992-01-02");
});
Deno.test("Legacy time settings import without inventing values", () => {
  const input = {
    format: "prometheus-configuration",
    version: 1,
    items: [{
      key: "time.preferences",
      value: {
        presentation: "core",
        direction: "elapsed",
        fill: "solid",
        units: { life: "days" },
      },
    }, {
      key: "time.lifeProfile",
      value: { birthDate: "2000-02-29", lifeHorizonAge: 88 },
    }],
  };
  const result = planImport(input, empty());
  equal(result.state.people[0].birth, "2000-02-29");
  equal(result.state.display.layout, "core");
  equal(result.state.display.units.life, "days");
  equal(
    (result.state.legacy["time.preferences"] as { fill: string }).fill,
    "solid",
  );
});
Deno.test("Invalid or over-capacity import leaves source data untouched", () => {
  const before = empty();
  const snapshot = JSON.stringify(before);
  let failed = false;
  try {
    planImport({
      items: [{
        key: "family.lifeCountdown",
        value: {
          ...family,
          members: {
            ...family.members,
            self: { ...family.members.self, birthDate: "2024-02-30" },
          },
        },
      }],
    }, before);
  } catch {
    failed = true;
  }
  assert(failed, "invalid date rejected");
  equal(JSON.stringify(before), snapshot);
  assert(!validBirth("2024-02-30") && validBirth("2000-02"), "date validity");
  const people: Person[] = Array.from(
    { length: 999 },
    (_, i) => ({
      id: `id-${i}`,
      name: `Person ${i}`,
      birth: "",
      lifespan: null,
      source: "unknown",
      tentative: false,
    }),
  );
  failed = false;
  try {
    planImport({ items: [{ key: "family.lifeCountdown", value: family }] }, {
      ...before,
      people,
      selected: people[0].id,
    });
  } catch {
    failed = true;
  }
  assert(failed, "overflow must refuse entire import");
});
Deno.test("Local writes require matching previous bytes and exact readback", () => {
  let data: string | null = null;
  const storage = {
    getItem: () => data,
    setItem: (_key: string, value: string) => {
      data = value;
    },
  };
  const state = empty();
  const receipt = persist(storage, null, state);
  equal(storage.getItem(), receipt);
  let failed = false;
  try {
    persist(storage, null, { ...state, revision: 1 });
  } catch {
    failed = true;
  }
  assert(failed, "stale tab cannot overwrite");
  equal(storage.getItem(), receipt);
  const rejects = {
    getItem: () => null,
    setItem: () => {
      throw Error("denied");
    },
  };
  failed = false;
  try {
    persist(rejects, null, state);
  } catch {
    failed = true;
  }
  assert(failed, "storage failures remain visible");
  let reads = 0;
  const noReadback = {
    getItem: (_key: string) => ++reads === 1 ? null : "changed",
    setItem: () => {},
  };
  failed = false;
  try {
    persist(noReadback, null, state);
  } catch {
    failed = true;
  }
  assert(failed, "readback mismatch cannot be acknowledged");
  equal(key, "timeleft.state.v1");
});

Deno.test("Names up to 200 characters and legacy playground bytes survive backup", () => {
  const base = empty();
  const person: Person = {
    id: "custom",
    name: "x".repeat(200),
    birth: "2000-02",
    lifespan: 90,
    source: "estimate",
    tentative: true,
  };
  const state: State = { ...base, people: [person], selected: person.id };
  assert(validState(state), "200 character name supported");
  assert(
    !validState({ ...state, people: [{ ...person, name: "x".repeat(201) }] }),
    "201 character name rejected",
  );
  const original = {
    birth: "1980-01-01",
    lifeExpectancy: 80,
    profile: "feminine",
    previewAge: null,
    motion: true,
    speed: 2,
    grainSize: 1,
    grainCount: 170,
    widthScale: 1,
  };
  const result = planImport({
    items: [{ key: "hourglass.playground", value: original }],
  }, state);
  equal(result.state.people[0].name, person.name);
  equal(result.state.legacy["hourglass.playground"], original);
});
