import {
  AssessmentResult,
  ConfidenceLevel,
  DimensionAssessment,
  FormDefinition,
  MaturityLevel,
} from './domain';

export function assessMaturity(
  form: FormDefinition,
  assessments: Record<string, DimensionAssessment>,
  manualLevelId: number | null = null,
  manualLevelJustification = '',
): AssessmentResult {
  const dimensions = form.dimensions;
  const assessed = dimensions
    .map((dimension) => assessments[dimension.id])
    .filter((assessment): assessment is DimensionAssessment =>
      typeof assessment?.score === 'number' &&
      Number.isInteger(assessment.score) &&
      assessment.score >= 0 &&
      assessment.score <= 3 &&
      assessment.justification.trim().length > 0 &&
      assessment.evidence.trim().length > 0 &&
      ['low', 'medium', 'high'].includes(assessment.confidence),
    );
  const score = assessed.reduce((sum, assessment) => sum + (assessment.score ?? 0), 0);
  const missing = dimensions.length - assessed.length;
  const byScore = (value: number): MaturityLevel =>
    form.maturityModel.levels.find((level) => value >= level.minScore && value <= level.maxScore) ??
    form.maturityModel.levels[form.maturityModel.levels.length - 1];
  const definitive = missing === 0;
  const manualLevel = manualLevelId === null || !validateManualLevel(form, manualLevelId, manualLevelJustification)
    ? null
    : form.maturityModel.levels.find((level) => level.id === manualLevelId) ?? null;
  const criticalConstraint = assessments['technology']?.criticalGap && assessments['technology']?.score === 0
    ? 'La ausencia de capacidad técnica para el evento está marcada como brecha crítica; el nivel numérico se limita a Activación mientras no se justifique una capacidad externa o una delegación.'
    : null;
  const highestBand = form.maturityModel.levels.find((item) => item.id === 2) ?? byScore(10);
  const rawLevel = byScore(score);
  const level = definitive
    ? manualLevel ?? (criticalConstraint && rawLevel.id > highestBand.id ? highestBand : rawLevel)
    : null;
  const confidence = aggregateConfidence(assessed.map((assessment) => assessment.confidence));
  const scores = dimensions.map((dimension) => assessments[dimension.id]?.score).filter(
    (value): value is number => typeof value === 'number',
  );
  const strengths = dimensions.flatMap((dimension) => {
    const assessment = assessments[dimension.id];
    return typeof assessment?.score === 'number' && assessment.score >= 2 && assessment.evidence.trim()
      ? [{ dimensionId: dimension.id, evidence: assessment.evidence.trim() }]
      : [];
  });
  const gaps = dimensions.flatMap((dimension) => {
    const assessment = assessments[dimension.id];
    return assessment?.score !== null && assessment?.score !== undefined && assessment.score <= 1
      ? [{
          dimensionId: dimension.id,
          score: assessment.score,
          justification: assessment.justification,
          critical: assessment.criticalGap,
        }]
      : [];
  });

  return {
    assessedDimensions: assessed.length,
    totalDimensions: dimensions.length,
    score,
    definitive,
    level,
    provisionalRange: definitive
      ? null
      : {
          minimum: byScore(score),
          maximum: criticalConstraint && byScore(score + missing * 3).id > highestBand.id
            ? highestBand
            : byScore(score + missing * 3),
        },
    confidence,
    criticalConstraint,
    strengths,
    gaps,
  };
}

function aggregateConfidence(values: (ConfidenceLevel | '')[]): AssessmentResult['confidence'] {
  if (values.length === 0) return 'insufficient';
  const counts = { low: 0, medium: 0, high: 0 };
  for (const value of values) {
    if (value) counts[value] += 1;
  }
  if (counts.low > counts.medium + counts.high) return 'low';
  if (counts.high >= counts.medium + counts.low) return 'high';
  return 'medium';
}

export function validateManualLevel(
  form: FormDefinition,
  levelId: number | null,
  justification: string,
): boolean {
  return levelId === null || (
    form.maturityModel.levels.some((level) => level.id === levelId) &&
    justification.trim().length >= 12
  );
}
