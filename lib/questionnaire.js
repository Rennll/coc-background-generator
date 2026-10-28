/**
 * Pure questionnaire rules. No DOM, browser APIs, file I/O, or persistence.
 */
export function getQuestionById(questionId, questionsData) {
  return questionsData.questions.find((question) => question.id === questionId) ?? null;
}
export function getQuestionOptions(questionId, answers, questionsData) {
  const question = getQuestionById(questionId, questionsData);
  if (!question) throw new Error(`Unknown question ID: ${questionId}`);
  if (question.optionsByParentOption) {
    const parentId = question.dependsOn?.questionId, parentAnswer = answers[parentId];
    if (!parentAnswer) return [];
    return question.optionsByParentOption[parentAnswer] ?? [];
  }
  return question.options ?? [];
}
export function isQuestionActive(questionId, answers, questionsData) {
  const question = getQuestionById(questionId, questionsData);
  if (!question) return false;
  if (!question.dependsOn) return true;
  const parentAnswer = answers[question.dependsOn.questionId];
  return !!parentAnswer && Object.hasOwn(question.optionsByParentOption ?? {}, parentAnswer);
}
export function validateAnswers(answers, questionsData) {
  const errors = [];
  for (const questionId of questionsData.flow) {
    const question = getQuestionById(questionId, questionsData);
    if (!question) { errors.push({ questionId, code: "unknown_question", message: `Flow references unknown question ${questionId}` }); continue; }
    if (!isQuestionActive(questionId, answers, questionsData)) continue;
    const answer = answers[questionId];
    if (question.required && (typeof answer !== "string" || answer.length === 0)) { errors.push({ questionId, code: "required", message: `${questionId} requires an answer` }); continue; }
    if (answer === undefined || answer === null || answer === "") continue;
    if (!getQuestionOptions(questionId, answers, questionsData).some(option => option.id === answer)) errors.push({ questionId, code: "invalid_option", message: `${questionId} has an invalid option ID` });
  }
  if (answers.Q10 === "other_custom" && !String(answers.customOccupation ?? "").trim()) errors.push({ questionId: "Q10", code: "custom_occupation_required", message: "Enter a custom occupation for Q10=other_custom" });
  return { valid: errors.length === 0, errors };
}
export function clearInvalidDependentAnswers(changedQuestionId, answers, questionsData) {
  const next = { ...answers }, childrenByParent = new Map();
  // The question's dependsOn field is the single source of truth for branching.
  // Do not rely on the parallel dependencies summary staying in sync.
  for (const question of questionsData.questions) {
    const parentQuestionId = question.dependsOn?.questionId;
    if (!parentQuestionId) continue;
    const list = childrenByParent.get(parentQuestionId) ?? [];
    list.push(question.id);
    childrenByParent.set(parentQuestionId, list);
  }
  const queue = [changedQuestionId], visited = new Set();
  while (queue.length) {
    const parentId = queue.shift(); if (visited.has(parentId)) continue; visited.add(parentId);
    for (const childId of childrenByParent.get(parentId) ?? []) {
      const selectedChildAnswer = next[childId], validChildOptions = getQuestionOptions(childId, next, questionsData);
      if (selectedChildAnswer && !validChildOptions.some(option => option.id === selectedChildAnswer)) delete next[childId];
      queue.push(childId);
    }
  }
  if (changedQuestionId === "Q10" && next.Q10 !== "other_custom") delete next.customOccupation;
  return next;
}
export function getActiveFlow(answers, questionsData) {
  return questionsData.flow.filter(questionId => isQuestionActive(questionId, answers, questionsData));
}
