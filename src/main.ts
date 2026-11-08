import { mountTimeCanvas, type TimeCanvasOptions } from "./engine/index.ts";
import { copy } from "./copy.ts";
import {
  empty,
  type ImportPlan,
  key,
  type Language,
  persist,
  type Person,
  planImport,
  type State,
  validBirth,
  validState,
} from "./model.ts";

const language = (): Language =>
  navigator.language.startsWith("zh")
    ? (/hant|tw|hk|mo/i.test(navigator.language) ? "zh-Hant" : "zh-Hans")
    : "en";
const root = document.querySelector<HTMLElement>("#app")!;
let state = empty(language()),
  expected: string | null = null,
  readFailed = false,
  unverified = false,
  dirty = false,
  pending: ImportPlan | null = null;
try {
  expected = localStorage.getItem(key);
  if (expected !== null) {
    const value: unknown = JSON.parse(expected);
    if (!validState(value)) throw Error("invalid_state");
    state = value;
  }
} catch {
  readFailed = true;
}
const t = (key: keyof typeof copy.en) => copy[state.language][key];
const esc = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]!),
  );
root.innerHTML =
  `<header><div class="brand"><span class="brand-mark" aria-hidden="true">◉</span><strong>TIMELEFT</strong></div><button id="settings" class="icon" type="button">⚙</button></header><section class="instrument"><div class="controls"><label class="control-label"><span id="personLabel"></span><select id="person"></select></label><button id="add" class="button add" type="button"></button><button id="layout" class="button layout" type="button"></button><button id="direction" class="button direction" type="button"></button></div><div id="scene" class="scene"></div><div class="hint" id="hint"></div></section><aside id="panel" hidden aria-labelledby="settingsTitle"><div class="panel-head"><h1 id="settingsTitle"></h1><button class="icon" id="close" type="button">×</button></div><div id="content"></div></aside><div id="status" class="status" role="status" aria-live="polite"></div><input id="file" type="file" accept="application/json,.json" hidden><div id="preview" class="preview" hidden><div class="preview-card" role="dialog" aria-modal="true" aria-labelledby="previewTitle"><h2 id="previewTitle"></h2><p id="previewSummary"></p><p class="details" id="previewDetails"></p><div class="actions"><button class="button" id="cancelImport" type="button"></button><button class="button" id="applyImport" type="button"></button></div></div></div>`;
const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const panel = el<HTMLElement>("panel"),
  content = el<HTMLElement>("content"),
  status = el<HTMLElement>("status"),
  select = el<HTMLSelectElement>("person"),
  dialog = el<HTMLElement>("preview");
const scene = el<HTMLDivElement>("scene");
const initial: TimeCanvasOptions = {
  birthDate: null,
  lifeHorizonAge: 1,
  locale: state.language,
  layout: state.display.layout,
  direction: state.display.direction,
  units: state.display.units,
  enabledUnits: state.display.enabledUnits,
  onUnitChange: (id, value) => unitChange(id, value),
};
const canvas = mountTimeCanvas(scene, initial);
function message(value: string) {
  status.textContent = value;
}
function write(next: State): boolean {
  if (readFailed) {
    message(t(unverified ? "unverified" : "readError"));
    return false;
  }
  try {
    const candidate = { ...next, revision: state.revision + 1 };
    expected = persist(localStorage, expected, candidate);
    state = candidate;
    message(t("saved"));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message === "readback_failed") {
      readFailed = true;
      unverified = true;
      message(t("unverified"));
    } else {message(
        error instanceof Error && error.message === "storage_conflict"
          ? t("conflict")
          : t("storageError"),
      );}
    return false;
  }
}
function mayDiscard() {
  if (!dirty) return true;
  if (!confirm(t("discard"))) return false;
  dirty = false;
  return true;
}
function selected() {
  return state.people.find((p) => p.id === state.selected);
}
function sceneUpdate() {
  const p = selected(),
    birth = p?.birth
      ? (p.birth.length === 7 ? `${p.birth}-01` : p.birth)
      : null;
  const today = new Date(),
    localToday = `${today.getFullYear().toString().padStart(4, "0")}-${
      String(today.getMonth() + 1).padStart(2, "0")
    }-${String(today.getDate()).padStart(2, "0")}`;
  const configured = !!birth && birth <= localToday && p?.lifespan !== null &&
    p?.lifespan !== undefined;
  el("hint").textContent = !p
    ? t("empty")
    : !configured
    ? t("unknown")
    : (p.tentative || p.source === "estimate" || p.birth.length === 7)
    ? t("approx")
    : "";
  canvas.update({
    birthDate: configured ? birth : null,
    lifeHorizonAge: p?.lifespan ?? 1,
    locale: state.language,
    layout: state.display.layout,
    direction: state.display.direction,
    units: state.display.units,
    enabledUnits: state.display.enabledUnits,
  });
}
function unitChange(id: string, value: string) {
  if (
    write({
      ...state,
      display: {
        ...state.display,
        units: { ...state.display.units, [id]: value },
      },
    })
  ) sceneUpdate();
  else sceneUpdate();
}
function render() {
  document.documentElement.lang = state.language;
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.font = state.font;
  el("personLabel").textContent = t("people");
  el("add").textContent = t("add");
  el("layout").textContent = `${t("layout")}: ${t(state.display.layout)}`;
  el("direction").textContent = `${t("direction")}: ${
    t(state.display.direction)
  }`;
  el("layout").setAttribute(
    "aria-label",
    `${t("layout")}: ${t(state.display.layout)}. ${
      t(state.display.layout === "contours" ? "core" : "contours")
    }`,
  );
  el("direction").setAttribute(
    "aria-label",
    `${t("direction")}: ${t(state.display.direction)}. ${
      t(state.display.direction === "remaining" ? "elapsed" : "remaining")
    }`,
  );
  el("settingsTitle").textContent = t("settings");
  el("settings").setAttribute("aria-label", t("settings"));
  el("close").setAttribute("aria-label", t("close"));
  select.innerHTML = state.people.length
    ? state.people.map((p) =>
      `<option value="${esc(p.id)}">${esc(p.name)}</option>`
    ).join("")
    : `<option value="">${esc(t("empty"))}</option>`;
  select.disabled = !state.people.length;
  select.value = state.selected;
  const p = selected();
  content.innerHTML = `${
    p
      ? `<section><h2>${t("people")}</h2><form id="personForm"><label>${
        t("name")
      }<input name="name" maxlength="200" required value="${
        esc(p.name)
      }"></label><label>${t("birth")}<input name="birth" placeholder="${
        t("birthHint")
      }" value="${esc(p.birth)}" inputmode="numeric"></label><label>${
        t("lifespan")
      }<input name="lifespan" type="number" min="1" max="200" step="1" value="${
        p.lifespan ?? ""
      }"></label><div class="actions"><button class="button" type="submit">${
        t("save")
      }</button><button class="danger" id="remove" type="button">${
        t("remove")
      }</button></div></form></section>`
      : ""
  }<section><h2>${t("appearance")}</h2><label>${t("theme")}<select id="theme">${
    (["system", "light", "dark"] as const).map((v) =>
      `<option value="${v}" ${state.theme === v ? "selected" : ""}>${
        t(v)
      }</option>`
    ).join("")
  }</select></label><label>${
    t("font")
  }<select id="font"><option value="system" ${
    state.font === "system" ? "selected" : ""
  }>${t("system")}</option><option value="pixel" ${
    state.font === "pixel" ? "selected" : ""
  }>${t("pixel")}</option></select></label><label>${
    t("language")
  }<select id="language"><option value="en">English</option><option value="zh-Hant">繁體中文</option><option value="zh-Hans">简体中文</option></select></label></section><section><h2>${
    t("data")
  }</h2><p>${
    t("importHelp")
  }</p><div class="actions"><button class="button" id="import" type="button">${
    t("import")
  }</button><button class="button" id="export" type="button">${
    t("export")
  }</button></div></section>`;
  el<HTMLSelectElement>("language").value = state.language;
  for (const id of ["theme", "font", "language"] as const) {
    const input = el<HTMLSelectElement>(id);
    input.onchange = () => {
      const value = input.value;
      if (!mayDiscard()) {
        input.value = state[id];
        return;
      }
      if (write({ ...state, [id]: value })) render();
    };
  }
  if (p) {
    const form = el<HTMLFormElement>("personForm");
    form.oninput = () => {
      dirty = true;
    };
    form.onsubmit = (event) => {
      event.preventDefault();
      const values = new FormData(form),
        name = String(values.get("name") ?? "").trim(),
        birth = String(values.get("birth") ?? "").trim(),
        raw = String(values.get("lifespan") ?? ""),
        lifespan = raw ? Number(raw) : null;
      if (!name) {
        message(t("nameError"));
        return;
      }
      if (!validBirth(birth)) {
        message(t("birthError"));
        return;
      }
      if (
        lifespan !== null &&
        (!Number.isInteger(lifespan) || lifespan < 1 || lifespan > 200)
      ) {
        message(t("lifespanError"));
        return;
      }
      const changed = birth !== p.birth || lifespan !== p.lifespan;
      if (
        write({
          ...state,
          people: state.people.map((x) =>
            x.id === p.id
              ? {
                ...p,
                name,
                birth,
                lifespan,
                ...(changed
                  ? { source: "owner" as const, tentative: false }
                  : {}),
              }
              : x
          ),
        })
      ) {
        dirty = false;
        render();
      }
    };
    el<HTMLButtonElement>("remove").onclick = () => {
      if (!mayDiscard() || !confirm(t("removeConfirm"))) return;
      const people = state.people.filter((x) => x.id !== p.id);
      if (write({ ...state, people, selected: people[0]?.id ?? "" })) render();
    };
  }
  el<HTMLButtonElement>("import").onclick = () => {
    if (mayDiscard()) el<HTMLInputElement>("file").click();
  };
  el<HTMLButtonElement>("export").onclick = () => {
    const a = document.createElement("a"),
      url = URL.createObjectURL(
        new Blob([JSON.stringify(state, null, 2)], {
          type: "application/json",
        }),
      );
    a.href = url;
    a.download = t("exportName");
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  sceneUpdate();
}
select.onchange = () => {
  const value = select.value;
  if (!mayDiscard()) {
    select.value = state.selected;
    return;
  }
  if (write({ ...state, selected: value })) render();
  else select.value = state.selected;
};
el<HTMLButtonElement>("add").onclick = () => {
  if (!mayDiscard()) return;
  if (state.people.length >= 1000) {
    message(t("capacity"));
    return;
  }
  const p: Person = {
    id: crypto.randomUUID(),
    name: t("newPerson"),
    birth: "",
    lifespan: null,
    source: "unknown",
    tentative: false,
  };
  if (write({ ...state, people: [...state.people, p], selected: p.id })) {
    panel.hidden = false;
    render();
    content.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
  }
};
el<HTMLButtonElement>("layout").onclick = () => {
  if (
    write({
      ...state,
      display: {
        ...state.display,
        layout: state.display.layout === "contours" ? "core" : "contours",
      },
    })
  ) {
    el("layout").textContent = `${t("layout")}: ${t(state.display.layout)}`;
    el("layout").setAttribute(
      "aria-label",
      `${t("layout")}: ${t(state.display.layout)}. ${
        t(state.display.layout === "contours" ? "core" : "contours")
      }`,
    );
    sceneUpdate();
  }
};
el<HTMLButtonElement>("direction").onclick = () => {
  if (
    write({
      ...state,
      display: {
        ...state.display,
        direction: state.display.direction === "remaining"
          ? "elapsed"
          : "remaining",
      },
    })
  ) {
    el("direction").textContent = `${t("direction")}: ${
      t(state.display.direction)
    }`;
    el("direction").setAttribute(
      "aria-label",
      `${t("direction")}: ${t(state.display.direction)}. ${
        t(state.display.direction === "remaining" ? "elapsed" : "remaining")
      }`,
    );
    sceneUpdate();
  }
};
el<HTMLButtonElement>("settings").onclick = () => {
  if (!panel.hidden && !mayDiscard()) return;
  panel.hidden = !panel.hidden;
};
el<HTMLButtonElement>("close").onclick = () => {
  if (!mayDiscard()) return;
  panel.hidden = true;
  el<HTMLButtonElement>("settings").focus();
};
el<HTMLInputElement>("file").onchange = async (event) => {
  const input = event.target as HTMLInputElement, file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 5_000_000) {
      message(t("tooLarge"));
      return;
    }
    const value: unknown = JSON.parse(await file.text());
    pending = planImport(value, state);
    el("previewTitle").textContent = t("report");
    el("previewSummary").textContent = pending.replace
      ? t("backupConfirm")
      : t("confirmImport");
    el("previewDetails").textContent = `${t("newData")}: ${pending.added} · ${
      t("skipped")
    }: ${pending.skipped} · ${t("displayChange")}: ${
      t(pending.displayImported ? "yes" : "no")
    }${pending.legacyPreserved ? ` · ${t("legacy")}` : ""}`;
    el("cancelImport").textContent = t("cancel");
    el("applyImport").textContent = t("apply");
    dialog.hidden = false;
    el<HTMLButtonElement>("cancelImport").focus();
  } catch (error) {
    message(
      error instanceof Error && error.message === "capacity"
        ? t("capacity")
        : t("badFile"),
    );
  } finally {
    input.value = "";
  }
};
el<HTMLButtonElement>("cancelImport").onclick = () => {
  pending = null;
  dialog.hidden = true;
  el<HTMLButtonElement>("import").focus();
};
el<HTMLButtonElement>("applyImport").onclick = () => {
  if (!pending) return;
  if (write(pending.state)) {
    dirty = false;
    pending = null;
    dialog.hidden = true;
    render();
    message(t("imported"));
    el<HTMLButtonElement>("import").focus();
  }
};
dialog.onkeydown = (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    el<HTMLButtonElement>("cancelImport").click();
  }
};
addEventListener("beforeunload", (event) => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
addEventListener("storage", (event) => {
  if (event.key === key && event.newValue !== expected) message(t("conflict"));
});
matchMedia("(prefers-color-scheme: dark)").addEventListener(
  "change",
  sceneUpdate,
);
render();
if (readFailed) message(t("readError"));
if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/sw.js").then(async (registration) => {
    await navigator.serviceWorker.ready;
    if (!readFailed && !status.textContent) {
      message(t("offlineReady"));
    }
    await registration.update();
  }).catch(() => {
    if (!readFailed && !status.textContent) message(t("offlineUnavailable"));
  });
} else if (!readFailed) message(t("offlineUnavailable"));
