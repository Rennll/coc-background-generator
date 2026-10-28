/** Pure export formatting. Browser clipboard/download effects belong in services/browser.js. */
/** Normalize the optional age field at the export boundary as well as in character editing. */
function normalizeExportAge(value) {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return null;
  if (typeof value !== "number" && typeof value !== "string") throw new Error("Age must be a non-negative integer or blank");
  const age = Number(value);
  if (!Number.isFinite(age) || !Number.isInteger(age) || age < 0) throw new Error("Age must be a non-negative integer or blank");
  return age;
}
export function exportJSON(character, createdAt = null) {
  const output = {
    version: 1,
    meta: { created_at: createdAt, generator: "CoC Investigator Background Generator" },
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
