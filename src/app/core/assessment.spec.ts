import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { assessMaturity, validateManualLevel } from './assessment';
import { createSession, DimensionAssessment, FormDefinition, QuestionResponse } from './domain';
import { isQuestionVisible } from './form-engine';
import { clientSafeResponse, createClientReport } from './report';
import { recommendServices } from './services.catalog';
import { SessionStore } from './session-store';

const dimensionNames = ['demand', 'content', 'presentation', 'technology', 'commercial', 'sustainability'];

function fixtureForm(): FormDefinition {
  return {
    schemaVersion: '1.0.0',
    formId: 'test-form',
    title: 'Prueba',
    description: 'Formulario de prueba',
    estimatedDurationMinutes: 45,
    client: {
      name: 'Cliente de prueba',
      project: 'Proyecto de prueba',
      productType: 'book',
      launchDate: '2026-10-17',
      reportedInitialSales: 12,
      salesOriginVerified: false,
      objectivesReported: ['Promoción'],
      notes: 'Dato reportado',
    },
    responseModel: { evidenceLevels: [{ id: 'documented', label: 'Documentado' }] },
    dimensions: dimensionNames.map((id) => ({ id, name: id })),
    sections: [],
    maturityModel: {
      id: 'test-maturity',
      maximumScore: 18,
      requireAllDimensionsForDefinitiveLevel: true,
      levels: [
        { id: 1, name: 'Exploración', minScore: 0, maxScore: 5, focus: 'Fundamentos', potentialServices: [], progressionRequirements: [] },
        { id: 2, name: 'Activación', minScore: 6, maxScore: 10, focus: 'Validación', potentialServices: [], progressionRequirements: [] },
        { id: 3, name: 'Lanzamiento estructurado', minScore: 11, maxScore: 14, focus: 'Ejecución', potentialServices: [], progressionRequirements: [] },
        { id: 4, name: 'Crecimiento sistemático', minScore: 15, maxScore: 18, focus: 'Optimización', potentialServices: [], progressionRequirements: [] },
      ],
      assessmentRules: [],
    },
    reportConfiguration: {
      clientPdf: { title: 'Informe', excludeFields: ['advisorPrivateNotes'] },
      internalReport: { includePrivateNotes: true },
    },
  };
}

function completedAssessments(scores: number[]): Record<string, DimensionAssessment> {
  return Object.fromEntries(dimensionNames.map((id, index) => [id, {
    score: scores[index],
    justification: `Evaluación sustentada ${id}`,
    evidence: `Evidencia ${id}`,
    confidence: 'medium' as const,
    state: scores[index] === 0 ? 'no_capacity' as const : scores[index] === 1 ? 'insufficient' as const : 'demonstrated' as const,
    criticalGap: id === 'technology' && scores[index] <= 1,
  }]));
}

describe('Metamag Discovery domain', () => {
  it('creates a reusable session with reported, unverified context', () => {
    const form = fixtureForm();
    const session = createSession(form, 'Asesora');
    expect(session.clientName).toBe('Cliente de prueba');
    expect(session.advisor).toBe('Asesora');
    expect(session.responses).toEqual({});
    expect(session.assessments['technology'].score).toBeNull();
    expect(session.knownState).toContain('origen de compradores no confirmado');
  });

  it('shows conditional questions only when their explicit choice matches', () => {
    const question = {
      id: 'MST-03A',
      text: 'Apoyo requerido',
      dimensionIds: ['technology'],
      followUps: [],
      advisorTip: '',
      riskSignal: '',
      expectedEvidence: [],
      condition: { questionId: 'MST-03', field: 'choice' as const, operator: 'equals' as const, value: 'No he participado' },
    };
    const response: QuestionResponse = {
      answer: '',
      choice: 'No he participado',
      evidence: '',
      evidenceLevel: '',
      status: 'answered',
      advisorPrivateNotes: '',
      followUpRequired: false,
    };
    expect(isQuestionVisible(question, { 'MST-03': response })).toBe(true);
    expect(isQuestionVisible(question, {})).toBe(false);
    expect(isQuestionVisible(question, { 'MST-03': { ...response, choice: 'Sí, como ponente' } })).toBe(false);
  });

  it('keeps unassessed dimensions out of the score and emits only a provisional range', () => {
    const form = fixtureForm();
    const partial = completedAssessments([2, 1, 0, 3, 2, 2]);
    partial['sustainability'] = { ...partial['sustainability'], score: null, justification: '', confidence: '', state: 'not_assessed' };
    const result = assessMaturity(form, partial);
    expect(result.score).toBe(8);
    expect(result.assessedDimensions).toBe(5);
    expect(result.definitive).toBe(false);
    expect(result.level).toBeNull();
    expect(result.provisionalRange?.minimum.name).toBe('Activación');
    expect(result.provisionalRange?.maximum.name).toBe('Lanzamiento estructurado');
  });

  it.each([
    [5, 1, 'Exploración'],
    [6, 2, 'Activación'],
    [10, 2, 'Activación'],
    [11, 3, 'Lanzamiento estructurado'],
    [14, 3, 'Lanzamiento estructurado'],
    [15, 4, 'Crecimiento sistemático'],
  ])('applies maturity band at total %i', (total, levelId, name) => {
    const form = fixtureForm();
    const scores = distribute(total);
    const result = assessMaturity(form, completedAssessments(scores));
    expect(result.definitive).toBe(true);
    expect(result.level?.id).toBe(levelId);
    expect(result.level?.name).toBe(name);
  });

  it('reflects three materially different client scenarios', () => {
    const form = fixtureForm();
    const novice = assessMaturity(form, completedAssessments([0, 0, 0, 0, 0, 0]));
    const communityWithoutEventTech = assessMaturity(form, completedAssessments([2, 2, 1, 0, 2, 2]));
    const matureOperator = assessMaturity(form, completedAssessments([3, 3, 3, 3, 3, 3]));
    expect(novice.level?.id).toBe(1);
    expect(communityWithoutEventTech.level?.id).toBe(2);
    expect(communityWithoutEventTech.gaps.some((gap) => gap.dimensionId === 'technology')).toBe(true);
    expect(matureOperator.level?.id).toBe(4);
    expect(novice.score).toBeLessThan(communityWithoutEventTech.score);
    expect(communityWithoutEventTech.score).toBeLessThan(matureOperator.score);
  });

  it('requires a written reason for a manual level and keeps event production conditional', () => {
    const form = fixtureForm();
    expect(validateManualLevel(form, 3, 'Ajuste')).toBe(false);
    expect(validateManualLevel(form, 3, 'Capacidad externa documentada')).toBe(true);
    const assessments = completedAssessments([2, 2, 1, 0, 2, 2]);
    const result = assessMaturity(form, assessments);
    const recommendations = recommendServices(form, result);
    expect(recommendations['masterclass-production'].status).toBe('recommended_conditionally');
    expect(recommendations['masterclass-production'].selected).toBe(true);
    expect(recommendations['event-readiness'].status).toBe('recommended_now');
  });

  it('does not silently let other strengths compensate for a critical zero in event technology', () => {
    const form = fixtureForm();
    const assessments = completedAssessments([3, 3, 3, 0, 3, 3]);
    const result = assessMaturity(form, assessments);
    expect(result.score).toBe(15);
    expect(result.level?.id).toBe(2);
    expect(result.criticalConstraint).toContain('brecha crítica');
  });

  it('excludes private notes from client-safe response projections', () => {
    const response: QuestionResponse = {
      answer: 'Respuesta visible',
      choice: '',
      evidence: 'Publicación revisada',
      evidenceLevel: 'observable',
      status: 'answered',
      advisorPrivateNotes: 'No debe salir al informe del cliente',
      followUpRequired: false,
    };
    const safe = clientSafeResponse(response);
    expect(safe).not.toHaveProperty('advisorPrivateNotes');
    expect(JSON.stringify(safe)).not.toContain('No debe salir');
  });

  it('persists and restores session answers and validates backup imports', async () => {
    const form = fixtureForm();
    const session = createSession(form);
    session.responses['CTX-01'] = {
      answer: 'Tres publicaciones recientes',
      choice: '',
      evidence: 'Enlaces compartidos en la reunión',
      evidenceLevel: 'observable',
      status: 'answered',
      advisorPrivateNotes: 'Revisar métricas en seguimiento',
      followUpRequired: true,
    };
    const store = new SessionStore();
    await store.load();
    await store.save(session);
    const recovered = new SessionStore();
    await recovered.load();
    expect(recovered.sessions().find((item) => item.id === session.id)?.responses['CTX-01'].answer)
      .toBe('Tres publicaciones recientes');
    const backup = JSON.parse(store.exportBackup([session])) as unknown;
    expect(await recovered.importBackup(backup)).toBe(1);
    await expect(recovered.importBackup({ sessions: [] })).rejects.toThrow('formato Metamag Discovery');
  });

  it('builds a client report without advisor-private note fields', () => {
    const form = fixtureForm();
    const session = createSession(form);
    session.responses['Q-1'] = {
      answer: 'Respuesta compartible',
      choice: '',
      evidence: 'Evidencia comprobable',
      evidenceLevel: 'documented',
      status: 'answered',
      advisorPrivateNotes: 'Nota estrictamente interna',
      followUpRequired: false,
    };
    const report = createClientReport(form, session);
    expect(JSON.stringify(report)).not.toContain('Nota estrictamente interna');
    expect(report.levelName).toBe('Evaluación provisional');
  });
});

function distribute(total: number): number[] {
  let remainder = total;
  return dimensionNames.map(() => {
    const score = Math.min(3, remainder);
    remainder -= score;
    return score;
  });
}
