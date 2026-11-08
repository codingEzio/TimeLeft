// Pure calendar validation adapted from code by codingEzio. No storage.
export function validateProfile(value, today = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value?.birthDate ?? "");
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(0);
  date.setUTCFullYear(y, m - 1, d);
  date.setUTCHours(0, 0, 0, 0);
  const localToday = `${today.getFullYear()}-${
    String(today.getMonth() + 1).padStart(2, "0")
  }-${String(today.getDate()).padStart(2, "0")}`;
  const age = Number(value.lifeHorizonAge);
  // Whole birthdays, within the four-digit calendar supported by date inputs.
  if (
    y < 1 || date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d || value.birthDate > localToday ||
    !Number.isSafeInteger(age) || age < 1 || y + age > 9999
  ) return null;
  return { birthDate: value.birthDate, lifeHorizonAge: age };
}

export function lifeTargetDate(profile) {
  const [year, month, day] = profile.birthDate.split("-").map(Number);
  const targetYear = year + profile.lifeHorizonAge;
  const lastDay = new Date(0);
  lastDay.setUTCFullYear(targetYear, month, 0);
  return {
    year: targetYear,
    month,
    day: Math.min(day, lastDay.getUTCDate()),
    hour: 0,
    minute: 0,
    second: 0,
  };
}
