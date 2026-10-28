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
  const approvedTitles = {Q1:"你的角色長什麼樣子？",Q2:"他／她相信什麼？",Q3a:"對他／她來說，最重要的人是誰？",Q3b:"你們之間發生過什麼？",Q4:"他／她珍藏著什麼？",Q5:"那樣東西為什麼重要？",Q6:"他／她最不希望發生什麼事？",Q7:"這份擔憂從何而來？",Q8:"他／她平常是什麼樣的人？",Q9:"哪個地方對他／她有特殊意義？",Q10:"你平常靠什麼維生？",Q11:"他／她如何捲入這次調查？"};
  for (const [id,title] of Object.entries(approvedTitles)) assert.equal(questions.questions.find(q=>q.id===id)?.title,title,id+" title matches spec");
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
  assert.match(c.background.significant_person,/父母或手足。他／她和家人共同經歷過/);
  assert.doesNotMatch(c.background.significant_person,/。；|。。/);
  assert.match(c.background.treasured_possession,/一件來歷不明、仍想查清楚的物品。他／她第一次見到它時/);
  assert.match(c.background.fear_or_concern,/他／她最不希望發生的事是再次相信某件後來證明是謊言的事。他／她曾因相信一項承諾而做出重大決定/);
  assert.equal(Object.keys(c.background).length,8);
  assert.match(c.background.meaningful_location,/^對他／她而言，特別有意義的地方是.+。$/u);
});
test("every conditional branch option generates all eight background fields without broken punctuation", () => {
  const parents = [
    {parent:"Q3a",child:"Q3b"},
    {parent:"Q4",child:"Q5"},
    {parent:"Q6",child:"Q7"},
    {parent:"Q10",child:"Q11"}
  ];
  for (const {parent,child} of parents) {
    const parentQuestion=questions.questions.find(q=>q.id===parent);
    for (const option of parentQuestion.options) {
      const answers=completeAnswers({[parent]:option.id,...(parent==="Q10"&&option.id==="other_custom"?{customOccupation:"鐘錶匠"}:{})});
      const childOptions=getQuestionOptions(child,answers,questions);
      assert.ok(childOptions.length>0, parent+"/"+option.id);
      answers[child]=childOptions[0].id;
      const character=buildCharacter(answers,templates,questions);
      assert.equal(Object.keys(character.background).length,8);
      for (const [field,value] of Object.entries(character.background)) {
        assert.equal(typeof value,"string",field);
        assert.doesNotMatch(value,/。。|；；|。；|；。/u,field+"/"+option.id);
      }
    }
  }
  for (const [child,parent] of [["Q3b","Q3a"],["Q5","Q4"],["Q7","Q6"],["Q11","Q10"]]) {
    const parentQuestion=questions.questions.find(q=>q.id===parent);
    for (const parentOption of parentQuestion.options) {
      const answers=completeAnswers({[parent]:parentOption.id,...(parent==="Q10"&&parentOption.id==="other_custom"?{customOccupation:"鐘錶匠"}:{})});
      for (const option of getQuestionOptions(child,answers,questions)) {
        const candidate={...answers,[child]:option.id};
        const character=buildCharacter(candidate,templates,questions);
        assert.equal(Object.keys(character.background).length,8);
        assert.ok(Object.values(character.background).every(value=>typeof value==="string"));
      }
    }
  }
});
test("all generated background fields read as complete sentences with terminal punctuation", () => {
  const parents = [
    {parent:"Q3a",child:"Q3b"},
    {parent:"Q4",child:"Q5"},
    {parent:"Q6",child:"Q7"},
    {parent:"Q10",child:"Q11"}
  ];
  const samples=[completeAnswers()];
  for(const {parent,child} of parents){
    const pq=questions.questions.find(q=>q.id===parent);
    for(const po of pq.options){
      const answers=completeAnswers({[parent]:po.id,...(parent==="Q10"&&po.id==="other_custom"?{customOccupation:"鐘錶匠"}:{})});
      const childOptions=getQuestionOptions(child,answers,questions);
      for(const co of childOptions) samples.push({...answers,[child]:co.id});
    }
  }
  for(const answers of samples){
    const character=buildCharacter(answers,templates,questions);
    for(const [field,value] of Object.entries(character.background)){
      assert.ok(value.trim().length>0,field);
      assert.match(value,/[。！？.!?]$/u,field+": "+value);
      assert.doesNotMatch(value,/。。|；；|。；|；。/u,field+": "+value);
    }
  }
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
  assert.ok(occupations.sources.some(source=>source.id==="chaosium_official_rules_wiki_occupations"));
  const sourceIds=new Set(occupations.sources.map(source=>source.id));
  const sourceStatuses=new Set(["user_provided_handbook_list","official_example_or_category_supported","official_product_page_example","official_example","to_verify_against_book","supplementary_unverified"]);
  for (const o of occupations.occupations) {
    assert.ok(o.name && o.category && o.sourceStatus && o.eraStatus && o.englishCandidate && o.translationStatus, o.id);
    assert.ok(sourceStatuses.has(o.sourceStatus),o.id+" has recognized source status");
    assert.ok(Array.isArray(o.sourceIds),o.id+" has source ID list");
    for(const sourceId of o.sourceIds) assert.ok(sourceIds.has(sourceId),o.id+" references known source "+sourceId);
    assert.equal(o.translationStatus,"project_candidate_not_verified_against_official_Chinese_edition",o.id+" does not overclaim official translation");
    if (o.sourceStatus === "supplementary_unverified") assert.equal(o.entryStatus,"supplementary");
  }
  const officialExamples=occupations.occupations.filter(o=>o.officialCorroborationStatus==="official_rules_wiki_example_only");
  assert.equal(officialExamples.length,8,"only eight entries are corroborated as official wiki examples");
  for(const o of officialExamples){assert.equal(o.officialCorroboration,"chaosium_official_rules_wiki_occupations");assert.match(o.notes,/不等於已核對 Investigator Handbook 原頁/);}
  assert.match(occupations.sources.find(source=>source.id==="chaosium_official_rules_wiki_occupations").supports,/不證明.*官方繁中譯名/);
  assert.equal(occupations.occupations.length,91,"canonical handbook entries");
  assert.equal(occupations.aliases.length,21,"cross-reference aliases");
  const canonicalIds=new Set(occupations.occupations.map(o=>o.id));
  for(const alias of occupations.aliases){assert.ok(alias.isAlias);assert.ok(canonicalIds.has(alias.aliasOf),alias.id+" points to canonical entry");}
  assert.deepEqual(occupations.occupations.find(o=>o.id==="criminal").crossReferences,["Gangster"]);
  assert.deepEqual(occupations.occupations.find(o=>o.id==="physician").crossReferences,["Psychiatrist"]);
  assert.deepEqual(occupations.occupations.find(o=>o.id==="pilot").crossReferences,["Aviator"]);
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
  let c=buildCharacter(completeAnswers(),templates,questions);
  c=updateCharacterField(c,"background","belief","");
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
  assert.throws(()=>buildCharacter(completeAnswers(),badTemplates,questions),/Template references unknown question ID/);
});
