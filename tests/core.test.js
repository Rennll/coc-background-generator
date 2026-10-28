import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { getQuestionOptions, validateAnswers, clearInvalidDependentAnswers, getActiveFlow } from "../lib/questionnaire.js";
import { buildCharacter, buildBackgroundText, buildFieldText, updateCharacterField } from "../lib/character.js";
import { exportJSON } from "../lib/export.js";

const questions = JSON.parse(fs.readFileSync(new URL("../data/questions.json", import.meta.url), "utf8"));
const templates = JSON.parse(fs.readFileSync(new URL("../data/templates.json", import.meta.url), "utf8"));
const occupations = JSON.parse(fs.readFileSync(new URL("../data/occupations.json", import.meta.url), "utf8"));
function completeAnswers(overrides = {}) {
  return {Q1:"neat_reliable",Q2:"truth_above_comfort",Q3a:"family_member",Q3b:"family_secret",Q4:"mysterious_object",Q5:"mystery_wrongness",Q6:"deceived_again",Q7:"deceived_belief_shattered",Q8:"quiet_listener",Q9:"private_corner",Q10:"knowledge_research",Q11:"research_contradiction",...overrides};
}

test("data files parse and agree on the eight background fields and five profile fields", () => {
  assert.equal(questions.questions.length, 12);
  assert.equal(questions.dependencies.length, 4);
  assert.equal(templates.profileFields.length, 5);
  assert.equal(Object.keys(templates.fieldLabels).length, 8);
  assert.deepEqual(Object.keys(templates.fieldLabels).sort(), Object.keys(templates.generationRules).sort());
  assert.deepEqual(templates.profileFields.map(f => f.id), ["name","occupation","age","birthplace","residence"]);
});
test("question and option IDs are unique and all conditional branches have valid parent IDs", () => {
  const ids = questions.questions.map(q => q.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const q of questions.questions) {
    const options = q.options ?? Object.values(q.optionsByParentOption ?? {}).flat();
    assert.equal(new Set(options.map(o => o.id)).size, options.length, q.id);
    if (q.optionsByParentOption) {
      const parent = questions.questions.find(p => p.id === q.dependsOn.questionId);
      assert.ok(parent, q.id + " parent exists");
      const parentIds = new Set((parent.options ?? []).map(o => o.id));
      for (const parentOptionId of Object.keys(q.optionsByParentOption)) assert.ok(parentIds.has(parentOptionId), q.id + "/" + parentOptionId);
    }
  }
});
test("all four conditional branches offer the expected number of options", () => {
  const expected = {Q3b:3,Q5:2,Q7:2,Q11:2};
  for (const [id,count] of Object.entries(expected)) {
    const q = questions.questions.find(x => x.id === id);
    for (const [parent,opts] of Object.entries(q.optionsByParentOption)) assert.equal(opts.length,count, id+"/"+parent);
  }
  assert.deepEqual(Object.fromEntries(questions.dependencies.map(d=>[d.parentQuestionId,d.childQuestionId])),{Q3a:"Q3b",Q4:"Q5",Q6:"Q7",Q10:"Q11"});
});
test("conditional options are selected by stable parent option ID, not label or array position", () => {
  assert.equal(getQuestionOptions("Q3b",{Q3a:"mentor"},questions)[0].id,"mentor_unthanked");
  assert.equal(getQuestionOptions("Q11",{Q10:"other_custom"},questions)[0].id,"custom_work_unusual_detail");
  assert.deepEqual(getQuestionOptions("Q5",{Q4:"unknown"},questions),[]);
});
test("changing a parent clears invalid dependent answers and preserves valid ones", () => {
  const invalid = clearInvalidDependentAnswers("Q3a",{Q3a:"mentor",Q3b:"family_secret"},questions);
  assert.equal(invalid.Q3a,"mentor"); assert.equal("Q3b" in invalid,false);
  const valid = clearInvalidDependentAnswers("Q3a",{Q3a:"mentor",Q3b:"mentor_unthanked"},questions);
  assert.equal(valid.Q3b,"mentor_unthanked");
  const q10 = clearInvalidDependentAnswers("Q10",{Q10:"other_custom",Q11:"research_contradiction",customOccupation:"Clockmaker"},questions);
  assert.equal("Q11" in q10,false);
  assert.equal(q10.customOccupation,"Clockmaker");
  assert.equal("customOccupation" in clearInvalidDependentAnswers("Q10",{Q10:"knowledge_research",Q11:"research_contradiction",customOccupation:"Clockmaker"},questions),false);
});
test("active flow omits unanswered conditional questions and includes the matching branches", () => {
  assert.deepEqual(getActiveFlow({},questions),["Q1","Q2","Q3a","Q4","Q6","Q8","Q9","Q10"]);
  const flow = getActiveFlow({Q3a:"mentor",Q4:"mysterious_object",Q6:"deceived_again",Q10:"other_custom"},questions);
  for (const id of ["Q3b","Q5","Q7","Q11"]) assert.ok(flow.includes(id));
});
test("validation rejects missing answers, invalid option IDs, and blank custom occupations", () => {
  assert.equal(validateAnswers(completeAnswers(),questions).valid,true);
  assert.ok(validateAnswers({...completeAnswers(),Q1:"bogus"},questions).errors.some(e=>e.code==="invalid_option"));
  const missing={...completeAnswers()}; delete missing.Q8;
  assert.ok(validateAnswers(missing,questions).errors.some(e=>e.questionId==="Q8"&&e.code==="required"));
  assert.ok(validateAnswers(completeAnswers({Q10:"other_custom",Q11:"custom_work_unusual_detail",customOccupation:"  "}),questions).errors.some(e=>e.code==="custom_occupation_required"));
});
test("narrative templates join the Q3/Q4/Q6 answers without awkward duplicate punctuation", () => {
  const c=buildCharacter(completeAnswers(),templates,questions);
  assert.match(c.background.significant_person,/父母或手足；他／她和家人共同經歷過/);
  assert.doesNotMatch(c.background.significant_person,/。；|。。/);
  assert.match(c.background.treasured_possession,/一件來歷不明、仍想查清楚的物品；他／她第一次見到它時/);
  assert.match(c.background.fear_or_concern,/事是：再次相信某件後來證明是謊言的事。這份擔憂的來源是：他／她曾全心相信/);
  assert.equal(Object.keys(c.background).length,8);
});
test("Q7/Q8/Q9/Q10 options match the confirmed wording and Q11 custom fallback", () => {
  assert.equal(getQuestionOptions("Q8",{},questions).length,7);
  assert.equal(getQuestionOptions("Q9",{},questions).length,6);
  assert.equal(getQuestionOptions("Q10",{},questions).length,8);
  assert.equal(getQuestionOptions("Q11",{Q10:"other_custom"},questions)[1].id,"custom_work_strange_request");
  assert.match(getQuestionOptions("Q7",{Q6:"secret_exposed"},questions)[1].label,/開始懷疑自己/);
});
test("all occupation IDs are unique, source labels are present, and list is not advertised as complete", () => {
  assert.equal(new Set(occupations.occupations.map(o=>o.id)).size,occupations.occupations.length);
  assert.match(occupations.scope,/not an official complete list/i);
  for (const o of occupations.occupations) {
    assert.ok(o.name && o.category && o.sourceStatus, o.id);
    if (o.sourceStatus === "supplementary_unverified") assert.equal(o.entryStatus,"supplementary");
  }
});
test("manual edits update character; full background omits blank fields and single-field copy preserves empty string", () => {
  let c=buildCharacter(completeAnswers(),templates,questions,{name:"林先生",age:34});
  c=updateCharacterField(c,"background","belief","");
  c=updateCharacterField(c,"profile","birthplace","");
  const text=buildBackgroundText(c,templates);
  assert.match(text,/姓名：林先生/); assert.match(text,/年齡：34/);
  assert.doesNotMatch(text,/信念：|出生地：|職業：|居住地：/);
  assert.equal(buildFieldText(c,"belief"),"");
  assert.throws(()=>buildFieldText(c,"not_a_field"),/Unknown background field/);
});
test("blank fields remain in the character model and JSON export; empty age becomes null", () => {
  const c=buildCharacter(completeAnswers(),templates,questions);
  const parsed=JSON.parse(exportJSON(c,"2026-10-27T00:00:00.000Z"));
  assert.equal(parsed.profile.age,null);
  assert.deepEqual(Object.keys(parsed.profile),["name","occupation","age","birthplace","residence"]);
  assert.deepEqual(Object.keys(parsed.background).sort(),Object.keys(templates.fieldLabels).sort());
  assert.equal(parsed.background.belief,"");
  for (const forbidden of ["rawAnswers","answers","stats","skills","during_play"]) assert.equal(forbidden in parsed,false);
  assert.equal("Q1" in parsed,false);
});
test("manual edits, including age and custom occupation, are reflected in exported JSON", () => {
  let c=buildCharacter(completeAnswers({Q10:"other_custom",Q11:"custom_work_unusual_detail",customOccupation:"鐘錶匠"}),templates,questions);
  c=updateCharacterField(c,"profile","age","42");
  c=updateCharacterField(c,"background","belief","我只相信證據。");
  const parsed=JSON.parse(exportJSON(c,"2026-10-28T00:00:00.000Z"));
  assert.equal(parsed.profile.occupation,"鐘錶匠"); assert.equal(parsed.profile.age,42);
  assert.equal(parsed.background.belief,"我只相信證據。");
  assert.throws(()=>updateCharacterField(c,"profile","age","3.5"),/Age must be/);
});
test("invalid answers and invalid template field references fail explicitly", () => {
  assert.throws(()=>buildCharacter(completeAnswers({Q3b:"wrong_branch"}),templates,questions),/Cannot build character/);
  const badTemplates={...templates,generationRules:{...templates.generationRules,appearance:{parts:[{answerFrom:"Q404"}]}}};
  assert.throws(()=>buildCharacter(completeAnswers(),badTemplates,questions),/Invalid option/);
});
