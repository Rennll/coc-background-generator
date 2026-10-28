import { getQuestionById, getQuestionOptions, isQuestionActive, validateAnswers } from "./questionnaire.js";
export const EMPTY_PROFILE = Object.freeze({ name:"", occupation:"", age:null, birthplace:"", residence:"" });
function optionLabel(questionId, optionId, answers, questionsData) {
  if (!optionId || !isQuestionActive(questionId, answers, questionsData)) return "";
  const option = getQuestionOptions(questionId, answers, questionsData).find(item => item.id === optionId);
  if (!option) throw new Error(`Invalid option "${optionId}" for ${questionId}`);
  return option.label;
}
function normalizeProfile(profile = {}) {
  const result = { ...EMPTY_PROFILE, ...profile };
  for (const key of ["name","occupation","birthplace","residence"]) result[key] = result[key] == null ? "" : String(result[key]);
  if (result.age === "" || result.age === undefined) result.age = null;
  else if (result.age !== null) {
    const age = Number(result.age);
    if (!Number.isFinite(age) || !Number.isInteger(age) || age < 0) throw new Error("Profile age must be a non-negative integer or null");
    result.age = age;
  }
  return result;
}
export function buildBackground(answers, templatesData, questionsData) {
  const fields = {};
  for (const [fieldId, rule] of Object.entries(templatesData.generationRules)) {
    const parts = [];
    for (const part of rule.parts) {
      if (!getQuestionById(part.answerFrom, questionsData)) throw new Error(`Template references unknown question ID: ${part.answerFrom}`);
      let text = optionLabel(part.answerFrom, answers[part.answerFrom], answers, questionsData).trim();
      if (part.stripTerminalPunctuation) text = text.replace(/[。！？.!?]+$/u, "");
      if (text) parts.push(text);
    }
    const body = parts.join(rule.separator ?? templatesData.composition.joinNonEmptyPartsWith ?? " ");
    fields[fieldId] = `${rule.prefix ?? ""}${body}${body ? (rule.suffix ?? "") : ""}`.trim();
  }
  return fields;
}
export function buildCharacter(answers, templatesData, questionsData, profile = {}) {
  const validation = validateAnswers(answers, questionsData);
  if (!validation.valid) throw new Error(`Cannot build character: ${validation.errors[0].message}`);
  const normalizedProfile = normalizeProfile(profile);
  if (!normalizedProfile.occupation && answers.Q10 === "other_custom") normalizedProfile.occupation = String(answers.customOccupation ?? "").trim();
  return { version:templatesData.exportContract.version, meta:{created_at:null,generator:templatesData.exportContract.meta.generator}, profile:normalizedProfile, background:buildBackground(answers,templatesData,questionsData) };
}
export function buildBackgroundText(character, templatesData) {
  const lines = [];
  for (const field of templatesData.profileFields ?? []) {
    const value = character.profile?.[field.id] == null ? "" : String(character.profile[field.id]).trim();
    if (value) lines.push(`${field.label}：${value}`);
  }
  for (const [fieldId,label] of Object.entries(templatesData.fieldLabels)) {
    const value = String(character.background?.[fieldId] ?? "").trim();
    if (value) lines.push(`${label}：${value}`);
  }
  return lines.join("\n");
}
export function buildFieldText(character, fieldId) {
  if (!Object.hasOwn(character.background ?? {}, fieldId)) throw new Error(`Unknown background field: ${fieldId}`);
  return String(character.background[fieldId] ?? "");
}
export function updateCharacterField(character, section, fieldId, value) {
  if (!["profile","background"].includes(section)) throw new Error(`Unknown section: ${section}`);
  if (!Object.hasOwn(character[section] ?? {}, fieldId)) throw new Error(`Unknown ${section} field: ${fieldId}`);
  const next = structuredClone(character);
  if (section === "profile" && fieldId === "age") {
    if (value === "" || value === null || value === undefined) next.profile.age = null;
    else { const age = Number(value); if (!Number.isInteger(age) || age < 0) throw new Error("Age must be a non-negative integer or blank"); next.profile.age = age; }
  } else next[section][fieldId] = value == null ? "" : String(value);
  return next;
}
