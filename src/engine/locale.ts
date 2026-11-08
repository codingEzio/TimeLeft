export type UiLocale = "en" | "zh-Hant" | "zh-Hans";

/** Match explicit choices and common BCP-47 Chinese variants. */
export function normalizeUiLocale(value: unknown): UiLocale {
  const locale = typeof value === "string"
    ? value.trim().replaceAll("_", "-").toLowerCase()
    : "";
  if (locale.startsWith("en")) return "en";
  if (/^zh-(?:hant|tw|hk|mo)(?:-|$)/.test(locale)) return "zh-Hant";
  if (locale.startsWith("zh")) return "zh-Hans";
  return "en";
}
