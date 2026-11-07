import { FormDefinition, GuidedQuestion, QuestionResponse } from './domain';

export function flattenQuestions(form: FormDefinition): GuidedQuestion[] {
  return form.sections.flatMap((section) => section.questions);
}

export function isQuestionVisible(
  question: GuidedQuestion,
  responses: Record<string, QuestionResponse>,
): boolean {
  const condition = question.condition;
  if (!condition) return true;
  const response = responses[condition.questionId];
  if (!response) return false;
  const value = response[condition.field];

  switch (condition.operator) {
    case 'answered':
      return typeof value === 'string' && value.trim().length > 0;
    case 'status_is':
      return response.status === condition.value;
    case 'equals':
      return value === condition.value;
    case 'not_equals':
      return value !== condition.value;
    case 'contains':
      return typeof value === 'string' && value.toLocaleLowerCase().includes((condition.value ?? '').toLocaleLowerCase());
  }
}

export function visibleQuestions(
  questions: GuidedQuestion[],
  responses: Record<string, QuestionResponse>,
): GuidedQuestion[] {
  return questions.filter((question) => isQuestionVisible(question, responses));
}
