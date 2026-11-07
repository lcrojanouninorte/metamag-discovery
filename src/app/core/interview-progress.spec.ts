import { beforeAll, describe, expect, it } from 'vitest';
import { createSession, FormDefinition, QuestionResponse } from './domain';
import {
  dimensionCoverage,
  ESSENTIAL_QUESTION_IDS,
  hasCapturedResponse,
  interviewCoverage,
  questionResponseState,
  questionsForInterview,
} from './interview-progress';

let form: FormDefinition;

beforeAll(async () => {
  form = JSON.parse(
    JSON.stringify((await import('../../assets/forms/form-demo.json')).default),
  ) as FormDefinition;
});

function response(
  patch: Partial<QuestionResponse> = {},
): QuestionResponse {
  return {
    answer: '',
    choice: '',
    evidence: '',
    evidenceLevel: '',
    status: 'pending',
    advisorPrivateNotes: '',
    followUpRequired: false,
    ...patch,
  };
}

describe('guided interview progress', () => {
  it('uses the 14-question essential route and includes conditional follow-ups only when visible', () => {
    const session = createSession(form);
    const essential = questionsForInterview(form, session);
    expect(essential).toHaveLength(14);
    expect(ESSENTIAL_QUESTION_IDS.size).toBe(14);
    expect(essential.some((question) => question.id === 'MST-03A')).toBe(false);
    session.responses['MST-03'] = response({ choice: 'No he participado' });
    expect(questionsForInterview(form, session).some((question) => question.id === 'MST-03A')).toBe(true);
    session.responses['MST-03'] = response({ choice: 'Sí, como ponente' });
    expect(questionsForInterview(form, session).some((question) => question.id === 'MST-03A')).toBe(false);
    expect(session.responses['MST-03A']).toBeUndefined();
  });

  it('keeps an inactive conditional response in history without counting it as applicable', () => {
    const session = createSession(form);
    session.responses['MST-03A'] = response({ answer: 'Ensayo técnico', status: 'answered' });
    session.responses['MST-03'] = response({ choice: 'Sí, como ponente' });
    const visible = questionsForInterview(form, session);
    expect(visible.some((question) => question.id === 'MST-03A')).toBe(false);
    expect(session.responses['MST-03A'].answer).toBe('Ensayo técnico');
  });

  it('distinguishes confirmed, declared, unknown, pending verification and not applicable information', () => {
    expect(questionResponseState(response({
      answer: 'Compartió publicación',
      status: 'answered',
      evidenceLevel: 'documented',
    }))).toBe('confirmed');
    expect(questionResponseState(response({ answer: 'Lo comentó', status: 'answered' }))).toBe('declared');
    expect(questionResponseState(response({ status: 'unknown' }))).toBe('unknown');
    expect(questionResponseState(response({ answer: 'Revisará después', status: 'requires_verification' }))).toBe('pending');
    expect(questionResponseState(response({ status: 'not_applicable' }))).toBe('not_applicable');
  });

  it('counts completed answers, unknowns and non-applicable responses while excluding unanswered questions from progress', () => {
    const session = createSession(form);
    const questions = questionsForInterview(form, session);
    const [confirmed, declared, unknown, notApplicable] = questions;
    session.responses[confirmed.id] = response({ answer: 'Hecho', evidenceLevel: 'observable', status: 'answered' });
    session.responses[declared.id] = response({ answer: 'Reportado', status: 'answered' });
    session.responses[unknown.id] = response({ status: 'unknown' });
    session.responses[notApplicable.id] = response({ status: 'not_applicable' });
    const progress = interviewCoverage(questions, session);
    expect(progress.answered).toBe(4);
    expect(progress.pending).toBe(10);
    expect(progress.confirmed).toBe(1);
    expect(progress.declared).toBe(1);
    expect(progress.unknown).toBe(1);
    expect(progress.notApplicable).toBe(1);
    expect(progress.percentage).toBe(29);
  });

  it('returns dimension coverage from only the questions applicable in the current mode', () => {
    const session = createSession(form);
    const questions = questionsForInterview(form, session);
    const context = questions.find((question) => question.id === 'CTX-01');
    if (!context) throw new Error('Expected CTX-01 in the essential route.');
    session.responses[context.id] = response({ answer: 'Publicación', status: 'answered' });
    const coverage = dimensionCoverage(form, questions, session);
    const content = coverage.find((dimension) => dimension.id === 'content');
    expect(content?.answered).toBe(1);
    expect(content?.applicable).toBeGreaterThan(0);
    expect(content?.pending).toBe(content!.applicable - 1);
  });

  it('does not count a status-only answer without response content as completed', () => {
    const statusOnly = response({ status: 'answered' });
    expect(hasCapturedResponse(statusOnly)).toBe(false);
    expect(questionResponseState(statusOnly)).toBe('pending');
  });
});
