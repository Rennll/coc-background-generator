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
test("template source-question references stay aligned with the questionnaire schema", () => {
  const questionIds = new Set(questions.questions.map(question => question.id));
  for (const [fieldId, rule] of Object.entries(templates.generationRules)) {
    assert.ok(Array.isArray(rule.questionIds), fieldId + " declares questionIds");
    assert.ok(Array.isArray(rule.parts), fieldId + " declares parts");
    for (const questionId of rule.questionIds) {
      assert.ok(questionIds.has(questionId), fieldId + " references known question " + questionId);
    }
    for (const part of rule.parts) {
      assert.ok(rule.questionIds.includes(part.answerFrom), fieldId + " part source " + part.answerFrom + " is declared in questionIds");
    }
  }
  const profileIds = templates.profileFields.map(field => field.id);
  assert.equal(new Set(profileIds).size, profileIds.length, "profile field IDs are unique");
  for (const field of templates.profileFields) {
    assert.ok(field.label && field.type && field.optional === true, field.id + " has label, type, and optional status");
  }
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
      assert.equal(q.dependsOn.operator,"equals_option_id",q.id+" declares a supported dependency operator");
      assert.deepEqual(Object.keys(q.optionsByParentOption).sort(),[...parentIds].sort(),
        q.id+" defines exactly one branch for every parent option");
      for (const parentOptionId of Object.keys(q.optionsByParentOption)) assert.ok(parentIds.has(parentOptionId), q.id + "/" + parentOptionId);
    }
  }
});
test("question options and dependency declarations reject malformed or unused data", () => {
  const questionIds = new Set(questions.questions.map(question => question.id));
  for (const question of questions.questions) {
    const allOptions = question.options ?? Object.values(question.optionsByParentOption ?? {}).flat();
    const optionIds = allOptions.map(option => option.id);
    assert.equal(new Set(optionIds).size, optionIds.length, question.id + " option IDs are unique across all branches");
    for (const option of allOptions) {
      assert.equal(typeof option.id, "string", question.id + " option has a string ID");
      assert.ok(option.id.trim(), question.id + " option ID is not blank");
      assert.equal(typeof option.label, "string", question.id + "/" + option.id + " has a string label");
      assert.ok(option.label.trim(), question.id + "/" + option.id + " label is not blank");
    }
    if (question.dependsOn) {
      assert.deepEqual(Object.keys(question.dependsOn).sort(), ["operator", "questionId"].sort(),
        question.id + " dependency has no unsupported keys");
      assert.ok(questionIds.has(question.dependsOn.questionId),
        question.id + " dependency references an existing question");
      assert.ok(question.optionsByParentOption && Object.keys(question.optionsByParentOption).length > 0,
        question.id + " conditional question has at least one declared branch");
      const parent = questions.questions.find(candidate => candidate.id === question.dependsOn.questionId);
      assert.ok(parent, question.id + " parent question exists");
      const parentOptionIds = parent.options.map(option => option.id).sort();
      assert.deepEqual(Object.keys(question.optionsByParentOption).sort(), parentOptionIds,
        question.id + " branch keys exactly match parent option IDs (no missing or extra branches)");
      for (const [parentOptionId, branchOptions] of Object.entries(question.optionsByParentOption)) {
        assert.ok(Array.isArray(branchOptions) && branchOptions.length > 0,
          question.id + "/" + parentOptionId + " branch is a non-empty option array");
      }
    }
  }
  for (const dependency of questions.dependencies) {
    assert.deepEqual(Object.keys(dependency).sort(), ["childQuestionId", "parentQuestionId"].sort(),
      "dependency summary has only supported fields");
  }
});

test("question flow and template formats reject incomplete or unsupported schema declarations", () => {
  const questionIds = questions.questions.map(question => question.id);
  assert.equal(new Set(questions.flow).size, questions.flow.length, "flow IDs are unique");
  assert.deepEqual([...questions.flow].sort(), [...questionIds].sort(),
    "every declared question appears exactly once in the user-facing flow");
  for (const questionId of questions.flow) assert.ok(questionIds.includes(questionId), "flow references known question " + questionId);
  for (const question of questions.questions) {
    assert.equal(Boolean(question.dependsOn), Boolean(question.optionsByParentOption),
      question.id + " must declare both dependsOn and optionsByParentOption, or neither");
    if (question.dependsOn) {
      assert.equal(question.dependsOn.operator, "equals_option_id", question.id + " uses the supported branch operator");
      assert.ok(question.dependsOn.questionId !== question.id, question.id + " cannot depend on itself");
    }
  }
  for (const [fieldId, rule] of Object.entries(templates.generationRules)) {
    const directSources = new Set(rule.parts.map(part => part.answerFrom));
    const branchParents = new Set(rule.parts
      .map(part => questions.questions.find(question => question.id === part.answerFrom)?.dependsOn?.questionId)
      .filter(Boolean));
    const expectedSources = new Set([...directSources, ...branchParents]);
    assert.deepEqual([...expectedSources].sort(), [...rule.questionIds].sort(),
      fieldId + " questionIds must include direct template sources and their branch-driving parent questions only");
    assert.equal(new Set(rule.questionIds).size, rule.questionIds.length,
      fieldId + " questionIds must not contain duplicates");
    for (const part of rule.parts) {
      assert.equal(part.format, "optionText", fieldId + " uses a supported template format");
      if (Object.hasOwn(part, "stripTerminalPunctuation")) {
        assert.equal(typeof part.stripTerminalPunctuation, "boolean", fieldId + " punctuation flag is boolean");
      }
      if (Object.hasOwn(part, "separator")) {
        assert.equal(typeof part.separator, "string", fieldId + " part separator is a string");
      }
    }
    for (const key of ["prefix", "suffix", "separator"]) {
      if (Object.hasOwn(rule, key)) assert.equal(typeof rule[key], "string", fieldId + " " + key + " is a string");
    }
  }
  assert.equal(typeof templates.composition.joinNonEmptyPartsWith, "string");
});

test("all four conditional branches offer the expected number of options", () => {
  const expected = {Q3b:3,Q5:2,Q7:2,Q11:2};
  for (const [id,count] of Object.entries(expected)) {
    const q = questions.questions.find(x => x.id === id);
    for (const [parent,opts] of Object.entries(q.optionsByParentOption)) assert.equal(opts.length,count, id+"/"+parent);
  }
  assert.deepEqual(Object.fromEntries(questions.dependencies.map(d=>[d.parentQuestionId,d.childQuestionId])),{Q3a:"Q3b",Q4:"Q5",Q6:"Q7",Q10:"Q11"});
  const dependenciesFromQuestions = questions.questions
    .filter(question => question.dependsOn)
    .map(question => ({parentQuestionId:question.dependsOn.questionId,childQuestionId:question.id}));
  assert.deepEqual(questions.dependencies,dependenciesFromQuestions,
    "the convenience dependency summary must match each question's dependsOn source of truth");
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
  const q4 = clearInvalidDependentAnswers("Q4",{Q4:"profession_item",Q5:"mystery_wrongness"},questions);
  assert.equal(q4.Q4,"profession_item"); assert.equal("Q5" in q4,false);
  const q4Valid = clearInvalidDependentAnswers("Q4",{Q4:"profession_item",Q5:"profession_first_recognition"},questions);
  assert.equal(q4Valid.Q5,"profession_first_recognition");
  const q6 = clearInvalidDependentAnswers("Q6",{Q6:"helpless_witness",Q7:"deceived_misunderstood"},questions);
  assert.equal(q6.Q6,"helpless_witness"); assert.equal("Q7" in q6,false);
  const q6Valid = clearInvalidDependentAnswers("Q6",{Q6:"helpless_witness",Q7:"helpless_could_not_help"},questions);
  assert.equal(q6Valid.Q7,"helpless_could_not_help");
  // Clearing must follow each question's dependsOn definition, not duplicated summary data.
  const withoutDependencySummary = {...questions,dependencies:[]};
  const q3WithoutSummary = clearInvalidDependentAnswers("Q3a",{Q3a:"mentor",Q3b:"family_secret"},withoutDependencySummary);
  assert.equal("Q3b" in q3WithoutSummary,false);
  const q4WithoutSummary = clearInvalidDependentAnswers("Q4",{Q4:"profession_item",Q5:"mystery_wrongness"},withoutDependencySummary);
  assert.equal("Q5" in q4WithoutSummary,false);
  const q6WithoutSummary = clearInvalidDependentAnswers("Q6",{Q6:"helpless_witness",Q7:"deceived_misunderstood"},withoutDependencySummary);
  assert.equal("Q7" in q6WithoutSummary,false);
  const q10WithoutSummary = clearInvalidDependentAnswers("Q10",{Q10:"other_custom",Q11:"research_contradiction",customOccupation:"Clockmaker"},withoutDependencySummary);
  assert.equal("Q11" in q10WithoutSummary,false);
  assert.equal(q10WithoutSummary.customOccupation,"Clockmaker");
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
  assert.match(c.background.fear_or_concern,/他／她最不希望發生的事是再次相信某件後來證明是謊言的事。他／她曾全心相信某個人或某種理念，後來才發現事實並非如此/);
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
        assert.equal(value,value.trim(),field+"/"+option.id+": no leading or trailing whitespace");
        assert.doesNotMatch(value,/\b(?:undefined|null)\b|\[object Object\]/u,field+"/"+option.id+": no leaked implementation values");
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
      assert.equal(value,value.trim(),field+": no leading or trailing whitespace");
      assert.doesNotMatch(value,/\b(?:undefined|null)\b|\[object Object\]/u,field+": no leaked implementation values");
    }
  }
});
test("Q7/Q8/Q9/Q10 options match the confirmed wording and Q11 custom fallback", () => {
  assert.equal(getQuestionOptions("Q8",{},questions).length,7);
  assert.equal(getQuestionOptions("Q9",{},questions).length,6);
  assert.equal(getQuestionOptions("Q10",{},questions).length,8);
  assert.equal(getQuestionOptions("Q11",{Q10:"other_custom"},questions)[1].id,"custom_work_strange_request");
  assert.match(getQuestionOptions("Q7",{Q6:"secret_exposed"},questions)[1].label,/開始懷疑自己/);
  assert.equal(getQuestionOptions("Q7",{Q6:"helpless_witness"},questions)[0].label,"他／她曾經在場，卻不知道該怎麼幫助對方。");
  assert.equal(getQuestionOptions("Q7",{Q6:"deceived_again"},questions)[0].label,"他／她曾全心相信某個人或某種理念，後來才發現事實並非如此。");
  assert.equal(getQuestionOptions("Q7",{Q6:"deceived_again"},questions)[1].label,"他／她至今仍不知道，自己當年究竟是被欺騙，還是誤解了對方。");
  assert.equal(getQuestionOptions("Q7",{Q6:"effort_wasted"},questions)[0].label,"他／她曾為某個目標犧牲許多，卻被迫半途放棄。");
});
test("all occupation IDs are unique, source labels are present, and list is not advertised as complete", () => {
  assert.equal(new Set(occupations.occupations.map(o=>o.id)).size,occupations.occupations.length);
  assert.equal(occupations.occupations.find(o=>o.id==="accountant").name,"會計人員","avoid implying a specific professional certification");
  assert.equal(occupations.occupations.find(o=>o.id==="deprogrammer").name,"反洗腦專家","preserve the sense of reversing indoctrination, not performing it");
  assert.equal(occupations.occupations.find(o=>o.id==="union_activist").name,"工會活動人士","use natural Taiwan Traditional Chinese wording");
  assert.match(occupations.scope,/not an official complete list/i);
  assert.match(occupations.scope,/user confirms.*checked word-for-word against a physical Investigator Handbook/i);
  assert.match(occupations.scope,/has not independently inspected that physical copy/i);
  assert.equal(occupations.sources.find(source=>source.id==="user_pasted_investigator_handbook_list").verificationStatus,"user_confirmed_physical_handbook_check_not_independently_repeated");
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
  const expectedHandbookNames = `Accountant
Acrobat
Actor
Agency Detective
Alienist
Animal Trainer
Antiquarian
Antique Dealer
Archaeologist
Architect
Artist
Asylum Attendant
Assassin
Athlete
Author
Aviator
Bank Robber
Bartender
Big Game Hunter
Book Dealer
Bootlegger
Bounty Hunter
Boxer/Wrestler
Burglar
Butler/Valet/Maid
Chauffeur
Clergy, Member of the
Computer Programmer/Technician/Hacker
Conman
Cowboy/girl
Craftsperson
Criminal
Cult Leader
Deprogrammer
Designer
Dilettante
Diver
Doctor of Medicine
Drifter
Driver
Editor
Elected Official
Engineer
Entertainer
Explorer
Farmer
Federal Agent
Fence
Firefighter
Foreign Correspondent
Forensic Surgeon
Forger/Counterfeiter
Gambler
Gangster
Gun Moll
Gentleman/Lady
Hacker
Hobo
Hospital Orderly
Journalist
Judge
Laboratory Assistant
Laborer
Lawyer
Librarian
Lumberjack
Maid
Mechanic (and Skilled Trades)
Military Officer
Miner
Missionary
Mountain Climber
Museum Curator
Musician
Nurse
Occultist
Outdoorsman/Outdoorswoman
Parapsychologist
Pharmacist
Photographer
Photojournalist
Pilot
Police Detective/Officer
Private Investigator
Professor
Prospector
Prostitute
Psychiatrist
Psychologist/Psychoanalyst
Reporter
Researcher
Sailor
Salesperson
Scientist
Secretary
Shopkeeper
Smuggler
Soldier/Marine
Spy
Street Punk
Student/Intern
Stuntman
Taxi Driver
Thug
Tribe Member
Undertaker
Union Activist
Valet
Waitress/Waiter
White-collar Worker
Zealot
Zookeeper`.split("\n");
  const actualHandbookNames = [...occupations.occupations,...occupations.aliases].map(o=>o.englishCandidate).sort();
  assert.equal(expectedHandbookNames.length,112,"the supplied Handbook list has 112 canonical names and see-aliases");
  assert.deepEqual(actualHandbookNames,[...expectedHandbookNames].sort(),
    "all supplied Handbook entries are represented exactly once, with no omissions or invented names");
  const expectedTags = {
    "Alienist":["Classic"], "Explorer":["Classic"],
    "Antiquarian":["Lovecraftian"], "Archaeologist":["Lovecraftian"],
    "Author":["Lovecraftian"], "Dilettante":["Lovecraftian"],
    "Doctor of Medicine":["Lovecraftian"], "Journalist":["Lovecraftian"],
    "Librarian":["Lovecraftian"], "Occultist":["Lovecraftian"],
    "Police Detective/Officer":["Lovecraftian"], "Professor":["Lovecraftian"],
    "Computer Programmer/Technician/Hacker":["Modern"], "Deprogrammer":["Modern"]
  };
  for(const [english,tags] of Object.entries(expectedTags)){
    const occupation=occupations.occupations.find(o=>o.englishCandidate===english);
    assert.ok(occupation,english+" exists in canonical data");
    assert.deepEqual(occupation.handbookTags,tags,english+" preserves the supplied handbook tag");
  }
  for(const occupation of occupations.occupations){
    assert.ok(["1920s_applicability_not_individually_verified","classic_tag_requires_review","lovecraftian_tag_requires_review","modern_only"].includes(occupation.eraStatus),occupation.englishCandidate+" has explicit era status");
  }
  const canonicalIds=new Set(occupations.occupations.map(o=>o.id));
  const allOccupationIds=[...occupations.occupations,...occupations.aliases].map(o=>o.id);
  assert.equal(new Set(allOccupationIds).size,allOccupationIds.length,"canonical and alias IDs share one collision-free namespace");
  assert.equal(new Set(occupations.aliases.map(o=>o.englishCandidate)).size,occupations.aliases.length,"alias English names are unique");
  for(const alias of occupations.aliases){
    assert.ok(alias.isAlias);
    assert.ok(canonicalIds.has(alias.aliasOf),alias.id+" points to canonical entry");
    assert.ok(alias.englishCandidate && alias.name && alias.notes,alias.id+" has a display name and cross-reference explanation");
    assert.ok(Array.isArray(alias.sourceIds) && alias.sourceIds.length>0,alias.id+" has provenance");
    for(const sourceId of alias.sourceIds) assert.ok(sourceIds.has(sourceId),alias.id+" references known source "+sourceId);
  }
  for(const id of ["alias_aviator","alias_gun_moll"]){const alias=occupations.aliases.find(a=>a.id===id);assert.deepEqual(alias.handbookTags,["Classic"],id+" preserves the Handbook Classic tag");assert.equal(alias.eraStatus,"classic_tag_requires_review",id+" does not overclaim 1920s suitability");}
  const pilot=occupations.occupations.find(o=>o.id==="pilot");assert.deepEqual(pilot.handbookTags,[]);assert.equal(pilot.eraStatus,"1920s_applicability_not_individually_verified","Aviator’s Classic tag must not transfer to Pilot");
  for(const alias of occupations.aliases){const target=occupations.occupations.find(o=>o.id===alias.aliasOf);assert.ok(target.crossReferences?.includes(alias.englishCandidate),`${alias.englishCandidate} cross-reference is visible on ${target.englishCandidate}`);}
  assert.deepEqual(occupations.occupations.find(o=>o.id==="criminal").crossReferences,["Gangster","Assassin","Bank Robber","Bootlegger","Burglar","Conman","Fence","Forger/Counterfeiter","Gun Moll","Smuggler","Street Punk","Thug"]);
  assert.deepEqual(occupations.occupations.find(o=>o.id==="physician").crossReferences,["Psychiatrist"]);
  assert.deepEqual(occupations.occupations.find(o=>o.id==="pilot").crossReferences,["Aviator"]);
});
test("editing one background field preserves every other generated field and custom occupation stays in profile", () => {
  const answers = completeAnswers({
    Q10: "other_custom",
    Q11: "custom_work_unusual_detail",
    customOccupation: "鐘錶匠"
  });
  const original = buildCharacter(answers, templates, questions);
  const edited = updateCharacterField(original, "background", "belief", "我只相信親眼查證的證據。");
  assert.equal(edited.background.belief, "我只相信親眼查證的證據。");
  for (const fieldId of Object.keys(templates.fieldLabels)) {
    if (fieldId === "belief") continue;
    assert.equal(edited.background[fieldId], original.background[fieldId],
      fieldId + " must remain unchanged when another field is edited");
  }
  assert.equal(edited.profile.occupation, "鐘錶匠");
  assert.equal(edited.background.investigation_hook, original.background.investigation_hook,
    "custom occupation is not implicitly injected into the Q11 narrative");
  assert.match(edited.background.investigation_hook, /工作|細節|異常|不尋常|線索|委託/u);
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
  assert.deepEqual(Object.keys(parsed).sort(),["background","meta","profile","version"]);
  assert.deepEqual(Object.keys(parsed.profile).sort(),["age","birthplace","name","occupation","residence"]);
  assert.deepEqual(Object.keys(parsed.background).sort(),["appearance","belief","fear_or_concern","investigation_hook","meaningful_location","personality","significant_person","treasured_possession"]);
  assert.deepEqual(Object.keys(parsed.meta).sort(),["created_at","generator"]);
  for(const forbidden of ["rawAnswers","answers","stats","skills","during_play"]) assert.equal(Object.hasOwn(parsed,forbidden),false,forbidden+" is excluded from export");
  assert.equal(parsed.meta.created_at,"2026-10-28T00:00:00.000Z");
  assert.throws(()=>updateCharacterField(c,"profile","age","3.5"),/Age must be/);
  assert.throws(()=>updateCharacterField(c,"profile","age","-1"),/Age must be/);
  assert.throws(()=>updateCharacterField(c,"profile","age","abc"),/Age must be/);
  c=updateCharacterField(c,"profile","age","");
  assert.equal(c.profile.age,null);
  assert.equal(JSON.parse(exportJSON(c)).profile.age,null);
  assert.equal(JSON.parse(exportJSON({...c,profile:{...c.profile,age:"   "}})).profile.age,null);
  assert.equal(JSON.parse(exportJSON({...c,profile:{...c.profile,age:""}})).profile.age,null);
  assert.equal(JSON.parse(exportJSON({...c,profile:{...c.profile,age:"42"}})).profile.age,42);
  assert.throws(()=>exportJSON({...c,profile:{...c.profile,age:false}}),/Age must be/);
  assert.throws(()=>exportJSON({...c,profile:{...c.profile,age:-1}}),/Age must be/);
  c=updateCharacterField(c,"profile","age","   ");
  assert.equal(c.profile.age,null);
  assert.equal(buildCharacter(completeAnswers(),templates,questions,{age:"   "}).profile.age,null);
  assert.throws(()=>buildCharacter(completeAnswers(),templates,questions,{age:-1}),/Profile age must be/);
  assert.throws(()=>buildCharacter(completeAnswers(),templates,questions,{age:3.5}),/Profile age must be/);
  assert.throws(()=>buildCharacter(completeAnswers(),templates,questions,{age:false}),/Profile age must be/);
  assert.throws(()=>buildCharacter(completeAnswers(),templates,questions,{age:{value:42}}),/Profile age must be/);
  assert.throws(()=>updateCharacterField(c,"profile","age",false),/Age must be/);
});
test("JSON export validates the complete version-1 contract and ignores extra character data", () => {
  const character = buildCharacter(completeAnswers(), templates, questions, {
    name: "測試角色", occupation: "研究員", age: 42, birthplace: "臺北", residence: "臺北"
  });
  character.rawAnswers = completeAnswers();
  character.stats = { STR: 99 };
  character.skills = ["occult"];
  character.background.unexpected = "must not export";
  const exported = JSON.parse(exportJSON(character, "2026-10-28T00:00:00.000Z"));
  assert.deepEqual(Object.keys(exported).sort(), ["background", "meta", "profile", "version"]);
  assert.deepEqual(Object.keys(exported.profile).sort(), ["age", "birthplace", "name", "occupation", "residence"]);
  assert.deepEqual(Object.keys(exported.background).sort(), Object.keys(templates.fieldLabels).sort());
  assert.equal(exported.meta.created_at, "2026-10-28T00:00:00.000Z");
  assert.equal(JSON.parse(exportJSON(character)).meta.created_at, null);
  assert.equal(JSON.parse(exportJSON(character, "2026-10-28T08:00:00+08:00")).meta.created_at, "2026-10-28T08:00:00+08:00");
  assert.equal(JSON.parse(exportJSON(character, "2026-10-28T14:00:00+14:00")).meta.created_at, "2026-10-28T14:00:00+14:00");
  assert.throws(() => exportJSON(character, "2026-10-28T14:01:00+14:01"), /created_at must be/);
  assert.throws(() => exportJSON(character, "2026-10-28T15:00:00+15:00"), /created_at must be/);
  assert.throws(() => exportJSON(character, "not-a-date"), /created_at must be/);
  assert.throws(() => exportJSON(character, "2026-02-30T00:00:00.000Z"), /created_at must be/);
  assert.throws(() => exportJSON(character, new Date("2026-10-28T00:00:00.000Z")), /created_at must be/);
  assert.equal(exported.profile.age, 42);
  assert.equal("rawAnswers" in exported, false);
  assert.equal("stats" in exported, false);
  assert.equal("skills" in exported, false);
  assert.equal("unexpected" in exported.background, false);
});
test("invalid answers and invalid template field references fail explicitly", () => {
  assert.throws(()=>buildCharacter(completeAnswers({Q3b:"wrong_branch"}),templates,questions),/Cannot build character/);
  const badTemplates={...templates,generationRules:{...templates.generationRules,appearance:{parts:[{answerFrom:"Q404"}]}}};
  assert.throws(()=>buildCharacter(completeAnswers(),badTemplates,questions),/Template references unknown question ID/);
  const missingRule={...templates,generationRules:{...templates.generationRules}};
  delete missingRule.generationRules.personality;
  assert.throws(()=>buildCharacter(completeAnswers(),missingRule,questions),/Missing generation rule for background field: personality/);
  const orphanRule={...templates,generationRules:{...templates.generationRules,unknown_field:{parts:[]}}};
  assert.throws(()=>buildCharacter(completeAnswers(),orphanRule,questions),/Generation rule references unknown background field: unknown_field/);
  const malformedRule={...templates,generationRules:{...templates.generationRules,appearance:{}}};
  assert.throws(()=>buildCharacter(completeAnswers(),malformedRule,questions),/Invalid generation rule for background field: appearance/);
  const malformedPart={...templates,generationRules:{...templates.generationRules,appearance:{parts:[{}]}}};
  assert.throws(()=>buildCharacter(completeAnswers(),malformedPart,questions),/Invalid template part for background field: appearance/);
});
