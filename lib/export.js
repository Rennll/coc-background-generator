/** Pure export formatting. Browser clipboard/download effects belong in services/browser.js. */
/** Normalize the optional age field at the export boundary as well as in character editing. */
function normalizeExportAge(value) {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return null;
  if (typeof value !== "number" && typeof value !== "string") throw new Error("Age must be a non-negative integer or blank");
  const age = Number(value);
  if (!Number.isFinite(age) || !Number.isInteger(age) || age < 0) throw new Error("Age must be a non-negative integer or blank");
  return age;
}
function normalizeCreatedAt(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("created_at must be an ISO-8601 timestamp or null");
  const match = /^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2})(?:\\.\\d{1,3})?(Z|[+-]\\d{2}:\\d{2})$/u.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) throw new Error("created_at must be a valid ISO-8601 timestamp or null");
  const [, year, month, day, hour, minute, second, zone] = match;
  const calendar = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const offsetHours = zone === "Z" ? 0 : Number(zone.slice(1, 3));
  const offsetMinutes = zone === "Z" ? 0 : Number(zone.slice(4, 6));
  if (calendar.getUTCFullYear() !== Number(year) || calendar.getUTCMonth() + 1 !== Number(month) ||
      calendar.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 ||
      Number(second) > 59 || offsetHours > 23 || offsetMinutes > 59) {
    throw new Error("created_at must be a valid ISO-8601 timestamp or null");
  }
  return value;
}
export function exportJSON(character, createdAt = null) {
  const output = {
    version: 1,
    meta: { created_at: normalizeCreatedAt(createdAt), generator: "CoC Investigator Background Generator" },
    profile: {
      name: String(character.profile?.name ?? ""),
      occupation: String(character.profile?.occupation ?? ""),
      age: normalizeExportAge(character.profile?.age),
      birthplace: String(character.profile?.birthplace ?? ""),
      residence: String(character.profile?.residence ?? "")
    },
    background: {
      appearance: String(character.background?.appearance ?? ""),
      belief: String(character.background?.belief ?? ""),
      significant_person: String(character.background?.significant_person ?? ""),
      treasured_possession: String(character.background?.treasured_possession ?? ""),
      fear_or_concern: String(character.background?.fear_or_concern ?? ""),
      personality: String(character.background?.personality ?? ""),
      meaningful_location: String(character.background?.meaningful_location ?? ""),
      investigation_hook: String(character.background?.investigation_hook ?? "")
    }
  };
  return JSON.stringify(output, null, 2);
}
