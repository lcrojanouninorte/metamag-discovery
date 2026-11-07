import { describe, expect, it } from 'vitest';
import {
  classifyGrowth,
  createGrowthEvaluation,
  GROWTH_CRITERIA,
  GROWTH_DIMENSIONS,
  GROWTH_LEVELS,
  GROWTH_METHODOLOGY,
  GROWTH_METHODOLOGY_VERSION,
  GROWTH_SERVICE_CATALOG,
  GrowthCriterion,
  GrowthCriterionStatus,
  GrowthEvaluation,
  invalidateGrowthEvidenceForQuestions,
  suggestGrowthPotential,
} from './growth-model';

function setCriterion(
  evaluation: GrowthEvaluation,
  criterion: GrowthCriterion,
  status: GrowthCriterionStatus = 'confirmed',
  fields: Partial<{
    result: string;
    evidence: string;
    justification: string;
  }> = {},
): void {
  evaluation.criteria[criterion.id] = {
    criterionId: criterion.id,
    status,
    result: fields.result ?? `Resultado observado para ${criterion.id}`,
    evidence: fields.evidence ?? `Registro verificable de ${criterion.id}`,
    justification: fields.justification ?? `Se confirma el criterio ${criterion.id} por el registro revisado.`,
    confidence: 'high',
  };
}

function confirmThrough(evaluation: GrowthEvaluation, levelId: string): void {
  const maximumOrder = GROWTH_LEVELS.find((level) => level.id === levelId)?.order ?? 0;
  for (const criterion of GROWTH_CRITERIA) {
    const criterionOrder = GROWTH_LEVELS.find((level) => level.id === criterion.levelId)?.order ?? 0;
    if (criterionOrder <= maximumOrder) setCriterion(evaluation, criterion);
  }
}

describe('versioned growth methodology', () => {
  it('exposes the stable levels, dimensions, and criterion structure', () => {
    expect(GROWTH_METHODOLOGY_VERSION).toBe('1.0.0');
    expect(GROWTH_METHODOLOGY.version).toBe(GROWTH_METHODOLOGY_VERSION);
    expect(GROWTH_LEVELS.map(({ name }) => name)).toEqual([
      'Exploración',
      'Activación',
      'Tracción',
      'Optimización',
      'Escalamiento',
    ]);
    expect(GROWTH_DIMENSIONS.map(({ id }) => id)).toEqual([
      'demand',
      'content',
      'presentation',
      'technology',
      'commercial',
      'sustainability',
    ]);
    expect(GROWTH_CRITERIA).toHaveLength(30);
    expect(new Set(GROWTH_CRITERIA.map(({ id }) => id)).size).toBe(30);
    expect(GROWTH_CRITERIA.every(
      ({ observableBehavior, evidenceRequired, auditRule, dimensionId, mandatory }) =>
        Boolean(observableBehavior && evidenceRequired && auditRule && dimensionId && mandatory),
    )).toBe(true);
  });

  it('returns indeterminate with explicit unknown counts when foundational evidence is absent', () => {
    const result = classifyGrowth(createGrowthEvaluation());

    expect(result.status).toBe('indeterminate');
    expect(result.level).toBeNull();
    expect(result.nextTarget?.id).toBe('exploracion');
    expect(result.nextTargetCounts).toEqual({
      unmetRequirements: 0,
      unknownRequirements: 6,
      totalRequirements: 6,
    });
    expect(Object.values(result.attainedByDimension)).toEqual(Array(6).fill(null));
    expect(suggestGrowthPotential(createGrowthEvaluation())).toEqual([]);
  });

  it('does not average uneven dimensions into a higher global level', () => {
    const evaluation = createGrowthEvaluation();
    confirmThrough(evaluation, 'exploracion');
    for (const dimensionId of ['demand', 'technology']) {
      const criterion = GROWTH_CRITERIA.find(
        (item) => item.levelId === 'activacion' && item.dimensionId === dimensionId,
      )!;
      setCriterion(evaluation, criterion);
    }

    const result = classifyGrowth(evaluation);
    expect(result.level?.id).toBe('exploracion');
    expect(result.nextTarget?.id).toBe('activacion');
    expect(result.nextTargetCounts.unknownRequirements).toBe(4);
    expect(result.attainedByDimension).toMatchObject({
      demand: 'activacion',
      technology: 'activacion',
      content: 'exploracion',
      presentation: 'exploracion',
      commercial: 'exploracion',
      sustainability: 'exploracion',
    });
  });

  it('reports unmet and unknown requirements separately for a partial gate', () => {
    const evaluation = createGrowthEvaluation();
    const exploration = GROWTH_CRITERIA.filter(({ levelId }) => levelId === 'exploracion');
    exploration.slice(0, 4).forEach((criterion) => setCriterion(evaluation, criterion));
    setCriterion(evaluation, exploration[4], 'not_met');
    setCriterion(evaluation, exploration[5], 'pending');

    const result = classifyGrowth(evaluation);
    expect(result.status).toBe('indeterminate');
    expect(result.level).toBeNull();
    expect(result.nextTargetCounts).toEqual({
      unmetRequirements: 1,
      unknownRequirements: 1,
      totalRequirements: 6,
    });

    setCriterion(evaluation, exploration[5], 'not_met');
    const fullyAudited = classifyGrowth(evaluation);
    expect(fullyAudited.status).toBe('below_foundation');
    expect(fullyAudited.nextTargetCounts).toMatchObject({
      unmetRequirements: 2,
      unknownRequirements: 0,
    });
  });

  it('does not let declared, not-applicable, or incomplete confirmations pass a gate', () => {
    const evaluation = createGrowthEvaluation();
    const exploration = GROWTH_CRITERIA.filter(({ levelId }) => levelId === 'exploracion');
    exploration.forEach((criterion) => setCriterion(evaluation, criterion));
    setCriterion(evaluation, exploration[0], 'declared');
    setCriterion(evaluation, exploration[1], 'not_applicable');
    setCriterion(evaluation, exploration[2], 'confirmed', { evidence: '' });
    setCriterion(evaluation, exploration[3], 'confirmed', { justification: '' });

    const result = classifyGrowth(evaluation);
    expect(result.status).toBe('indeterminate');
    expect(result.level).toBeNull();
    expect(result.nextTargetCounts.unknownRequirements).toBe(4);
    expect(result.attainedByDimension.demand).toBeNull();
  });

  it('invalidates linked evidence when an interview source changes', () => {
    const evaluation = createGrowthEvaluation();
    const demand = GROWTH_CRITERIA.find(
      ({ levelId, dimensionId }) => levelId === 'exploracion' && dimensionId === 'demand',
    )!;
    setCriterion(evaluation, demand);
    evaluation.criteria[demand.id] = { ...evaluation.criteria[demand.id]!, linkedQuestionIds: ['AUD-01'] };
    const updated = invalidateGrowthEvidenceForQuestions(evaluation, new Set(['AUD-01']));

    expect(updated.criteria[demand.id]?.status).toBe('pending');
    expect(updated.criteria[demand.id]?.sourceInvalidated).toBe(true);
    expect(classifyGrowth(updated).level).toBeNull();
    expect(classifyGrowth(updated).nextTargetCounts.unknownRequirements).toBe(6);
  });

  it('does not use sales counts or a numeric result as a classification shortcut', () => {
    const evaluation = createGrowthEvaluation();
    const criterion = GROWTH_CRITERIA[0];
    setCriterion(evaluation, criterion, 'confirmed', {
      result: 'La persona reporta 100 ventas iniciales.',
    });

    const result = classifyGrowth(evaluation);
    expect(result.status).toBe('indeterminate');
    expect(result.level).toBeNull();
    expect(result.nextTargetCounts.unknownRequirements).toBe(5);
  });

  it('does not apply this methodology to an evaluation from another version', () => {
    const evaluation = createGrowthEvaluation();
    confirmThrough(evaluation, 'escalamiento');
    evaluation.methodologyVersion = '0.9.0';

    const result = classifyGrowth(evaluation);
    expect(result.status).toBe('indeterminate');
    expect(result.level).toBeNull();
    expect(result.nextTargetCounts.unknownRequirements).toBe(6);
    expect(suggestGrowthPotential(evaluation)).toEqual([]);
  });

  it('updates classification deterministically when evidence changes', () => {
    const evaluation = createGrowthEvaluation();
    confirmThrough(evaluation, 'activacion');
    const activationCommercial = GROWTH_CRITERIA.find(
      ({ levelId, dimensionId }) => levelId === 'traccion' && dimensionId === 'commercial',
    )!;
    GROWTH_CRITERIA.filter(({ levelId }) => levelId === 'traccion').forEach((criterion) =>
      setCriterion(evaluation, criterion, criterion.id === activationCommercial.id ? 'pending' : 'confirmed'),
    );

    const before = classifyGrowth(evaluation);
    expect(before.level?.id).toBe('activacion');
    expect(before.nextTarget?.id).toBe('traccion');

    setCriterion(evaluation, activationCommercial, 'confirmed');
    expect(classifyGrowth(evaluation).level?.id).toBe('traccion');

    const foundationDemand = GROWTH_CRITERIA.find(
      ({ levelId, dimensionId }) => levelId === 'exploracion' && dimensionId === 'demand',
    )!;
    setCriterion(evaluation, foundationDemand, 'not_met');
    const afterRegression = classifyGrowth(evaluation);
    expect(afterRegression.level).toBeNull();
    expect(afterRegression.status).toBe('below_foundation');
    expect(afterRegression.nextTarget?.id).toBe('exploracion');
  });

  it('requires documented not-met evidence to suggest a gap service', () => {
    const evaluation = createGrowthEvaluation();
    const demandCriterion = GROWTH_CRITERIA.find(
      ({ levelId, dimensionId }) => levelId === 'exploracion' && dimensionId === 'demand',
    )!;
    setCriterion(evaluation, demandCriterion, 'not_met', { evidence: '' });
    expect(suggestGrowthPotential(evaluation)).toEqual([]);
    expect(classifyGrowth(evaluation).nextTargetCounts.unknownRequirements).toBe(6);

    setCriterion(evaluation, demandCriterion, 'not_met');
    const suggestions = suggestGrowthPotential(evaluation);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].service.id).toBe('audience-and-offer-clarity');
    expect(suggestions[0].basis).toBe('documented_gap');
    expect(suggestions[0].criterionIds).toContain(demandCriterion.id);
    expect(suggestions[0].supportingEvidence[0].evidence).toContain(demandCriterion.id);
  });

  it('allows confirmed evidence to support next-stage exploration without claiming need', () => {
    const evaluation = createGrowthEvaluation();
    confirmThrough(evaluation, 'exploracion');

    const suggestion = suggestGrowthPotential(evaluation).find(
      ({ service }) => service.id === 'activation-pilot',
    );
    expect(suggestion?.basis).toBe('next_stage_support');
    expect(suggestion?.levelId).toBe('activacion');
    expect(suggestion?.rationale).toContain('no implica una necesidad');
  });

  it('defines operational responsibilities and evidence for each catalog entry', () => {
    expect(GROWTH_SERVICE_CATALOG.length).toBeGreaterThan(0);
    const criterionIds = new Set(GROWTH_CRITERIA.map(({ id }) => id));
    const serviceIds = new Set(GROWTH_SERVICE_CATALOG.map(({ id }) => id));
    const levelIds = new Set(GROWTH_LEVELS.map(({ id }) => id));
    for (const service of GROWTH_SERVICE_CATALOG) {
      expect(service.problem).toBeTruthy();
      expect(service.applicableLevelIds.length).toBeGreaterThan(0);
      expect(service.applicableLevelIds.every((id) => levelIds.has(id))).toBe(true);
      expect(service.dependencies.every((id) => serviceIds.has(id))).toBe(true);
      expect([
        ...service.prerequisiteCriteria,
        ...service.gapCriteria,
        ...service.supportCriteria,
      ].every((id) => criterionIds.has(id))).toBe(true);
      expect(service.evidenceBasis.length).toBeGreaterThan(0);
      expect(service.deliverables.length).toBeGreaterThan(0);
      expect(service.priority).toMatch(/^(high|medium|low)$/);
      expect(service.responsibilities.client.length).toBeGreaterThan(0);
      expect(service.responsibilities.agency.length).toBeGreaterThan(0);
    }
  });
});
