import { DiscoverySession, FormDefinition, GuidedQuestion, QuestionResponse } from './domain';
import { isQuestionVisible } from './form-engine';

export type InformationState = 'confirmed' | 'declared' | 'pending' | 'not_applicable' | 'unknown';

export interface DimensionCoverage {
  id: string;
  name: string;
  answered: number;
  applicable: number;
  pending: number;
}

export interface InterviewCoverage {
  answered: number;
  applicable: number;
  pending: number;
  notApplicable: number;
  confirmed: number;
  declared: number;
  unknown: number;
  percentage: number;
}

export const ESSENTIAL_QUESTION_IDS = new Set([
  'CTX-01', 'CTX-02',
  'AUD-01', 'AUD-04',
  'COM-01', 'COM-04',
  'MST-01', 'MST-03',
  'SAL-02', 'SAL-03',
  'RES-01', 'RES-04',
  'CLS-01', 'CLS-02',
]);

export function questionsForInterview(
  form: FormDefinition,
  session: DiscoverySession,
): GuidedQuestion[] {
  const mode = session.interviewMode ?? 'complete';
  return form.sections.flatMap((section) => section.questions).filter((question) => {
    if (!isQuestionVisible(question, session.responses)) return false;
    if (mode === 'complete') return true;
    return ESSENTIAL_QUESTION_IDS.has(question.id) ||
      (!!question.condition && ESSENTIAL_QUESTION_IDS.has(question.condition.questionId));
  });
}

export function questionResponseState(response?: QuestionResponse): InformationState {
  if (!response || response.status === 'pending' || response.status === 'requires_verification') return 'pending';
  if (response.status === 'not_applicable') return 'not_applicable';
  if (response.status === 'unknown') return 'unknown';
  if (!response.answer.trim() && !response.choice.trim() && !response.evidence.trim()) return 'pending';
  if (response.evidenceLevel === 'observable' || response.evidenceLevel === 'documented') return 'confirmed';
  return 'declared';
}

export function hasCapturedResponse(response?: QuestionResponse): boolean {
  if (!response || response.status === 'pending') return false;
  if (response.status === 'unknown' || response.status === 'not_applicable') return true;
  return Boolean(response.answer.trim() || response.choice.trim() || response.evidence.trim());
}

export function interviewCoverage(questions: GuidedQuestion[], session: DiscoverySession): InterviewCoverage {
  const states = questions.map((question) => questionResponseState(session.responses[question.id]));
  const answered = questions.filter((question) => hasCapturedResponse(session.responses[question.id])).length;
  const applicable = questions.length;
  return {
    answered,
    applicable,
    pending: applicable - answered,
    notApplicable: states.filter((state) => state === 'not_applicable').length,
    confirmed: states.filter((state) => state === 'confirmed').length,
    declared: states.filter((state) => state === 'declared').length,
    unknown: states.filter((state) => state === 'unknown').length,
    percentage: applicable === 0 ? 0 : Math.round(answered * 100 / applicable),
  };
}

export function dimensionCoverage(
  form: FormDefinition,
  questions: GuidedQuestion[],
  session: DiscoverySession,
): DimensionCoverage[] {
  return form.dimensions.map((dimension) => {
    const applicableQuestions = questions.filter((question) => question.dimensionIds.includes(dimension.id));
    const answered = applicableQuestions.filter((question) =>
      hasCapturedResponse(session.responses[question.id]),
    ).length;
    return {
      id: dimension.id,
      name: dimension.name,
      answered,
      applicable: applicableQuestions.length,
      pending: applicableQuestions.length - answered,
    };
  });
}
