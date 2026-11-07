import { assessMaturity } from './assessment';
import { DiscoverySession, ExecutiveSummary, FormDefinition, QuestionResponse, ServiceRecommendation, emptyExecutiveSummary } from './domain';
import { interviewCoverage, dimensionCoverage, questionsForInterview } from './interview-progress';
import { serviceById } from './services.catalog';
import {
  classifyGrowth,
  createGrowthEvaluation,
  GROWTH_CRITERIA,
  GROWTH_DIMENSIONS,
  GROWTH_LEVELS,
  GROWTH_SERVICE_CATALOG,
  growthRequirementState,
  GrowthCriterionStatus,
  GROWTH_METHODOLOGY_VERSION,
  suggestGrowthPotential,
} from './growth-model';

export interface ClientReport {
  clientName: string;
  organization: string;
  project: string;
  meetingDate: string;
  objective: string;
  levelName: string;
  levelFocus: string;
  score: number;
  confidence: string;
  methodologyVersion: string;
  generatedAt: string;
  isExample: boolean;
  summaryApproved: boolean;
  executiveSummary: ExecutiveSummary;
  growthApproved: boolean;
  growthClassification: ReturnType<typeof classifyGrowth>;
  growthLevels: typeof GROWTH_LEVELS;
  growthDimensionLevels: { id: string; name: string; levelName: string | null }[];
  growthRequirements: {
    id: string;
    levelId: string;
    levelName: string;
    dimensionName: string;
    observableBehavior: string;
    evidenceRequired: string;
    status: GrowthCriterionStatus;
    state: 'passed' | 'unmet' | 'unknown';
    result: string;
    evidence: string;
    justification: string;
    confidence: string;
  }[];
  growthServices: ReturnType<typeof suggestGrowthPotential>;
  coverage: ReturnType<typeof interviewCoverage>;
  dimensionCoverage: ReturnType<typeof dimensionCoverage>;
  dimensions: { name: string; score: number | null; evidence: string; justification: string }[];
  strengths: { dimensionId: string; evidence: string }[];
  gaps: { dimensionId: string; justification: string; critical: boolean }[];
  services: { name: string; status: string; justification: string }[];
  roadmap: { name: string; focus: string; requirements: string[] }[];
  actions: DiscoverySession['actions'];
  executiveConclusion: string;
  executiveStrengths: string[];
  executiveOpportunities: string[];
  primaryPriority: string;
  confirmedFindings: string[];
  declaredFindings: string[];
  pendingFindings: string[];
  priorityActions: {
    dimension: string;
    action: string;
    reason: string;
    evidenceToConfirm: string;
    state: 'unmet' | 'unknown';
  }[];
  clientServices: {
    name: string;
    problem: string;
    solution: string;
    deliverables: string[];
    operationalOutcome: string;
    dependencies: string[];
    clientResponsibilities: string[];
    metamagResponsibilities: string[];
  }[];
  clientAgreements: { title: string; detail: string }[];
}

export function createClientReport(form: FormDefinition, session: DiscoverySession): ClientReport {
  const result = assessMaturity(form, session.assessments, session.manualLevelId, session.manualLevelJustification);
  const growthApproved = session.growthClassificationApproved === true;
  const growthEvaluation = growthApproved
    ? session.growthEvaluation ?? createGrowthEvaluation()
    : createGrowthEvaluation();
  const growthClassification = classifyGrowth(growthEvaluation);
  const executiveSummary = session.executiveSummaryApproved
    ? { ...emptyExecutiveSummary(), ...session.executiveSummary }
    : emptyExecutiveSummary();
  const nextLevelCriteria = growthApproved && growthClassification.nextTarget
    ? GROWTH_CRITERIA.filter((criterion) =>
      criterion.levelId === growthClassification.nextTarget!.id,
    )
    : [];
  const priorityActions = nextLevelCriteria
    .map((criterion) => {
      const observed = growthEvaluation.criteria[criterion.id];
      const state = growthRequirementState(criterion, observed);
      if (state === 'passed') return null;
      const dimension = GROWTH_DIMENSIONS.find((item) => item.id === criterion.dimensionId)?.name ?? '';
      return {
        dimension,
        action: state === 'unmet'
          ? `Resolver: ${criterion.observableBehavior}`
          : `Confirmar: ${criterion.observableBehavior}`,
        reason: observed?.justification || observed?.result || '',
        evidenceToConfirm: state === 'unknown' ? criterion.evidenceRequired : '',
        state,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .slice(0, 5);
  const growthServices = suggestGrowthPotential(growthEvaluation);
  const clientServices = [
    ...growthServices
      .filter(({ basis }) => basis === 'documented_gap')
      .map(({ service }) => ({
        name: service.name,
        problem: service.problem,
        solution: `Diseñar y desarrollar ${service.deliverables.join(', ').toLocaleLowerCase('es')} para atender esta brecha.`,
        deliverables: [...service.deliverables],
        operationalOutcome: `El equipo contará con ${service.deliverables.join(', ').toLocaleLowerCase('es')} para abordar esta brecha.`,
        dependencies: service.dependencies.map((id) =>
          GROWTH_SERVICE_CATALOG.find((item) => item.id === id)?.name ?? '',
        ).filter(Boolean),
        clientResponsibilities: [...service.responsibilities.client],
        metamagResponsibilities: [...service.responsibilities.agency],
      })),
    ...Object.values(session.recommendations)
      .filter((recommendation): recommendation is ServiceRecommendation =>
        !!recommendation?.selected && recommendation.status !== 'requires_validation',
      )
      .map((recommendation) => {
        const service = serviceById(recommendation.serviceId);
        if (!service) return null;
        const dependencyNames = service.dependencies
          .map((id) => serviceById(id)?.name)
          .filter((name): name is string => !!name);
        return {
          name: service.name,
          problem: service.problem,
          solution: service.description,
          deliverables: [...service.deliverables],
          operationalOutcome: `El equipo contará con ${service.deliverables.join(', ').toLocaleLowerCase('es')} para ${service.description.toLocaleLowerCase('es')}`,
          dependencies: dependencyNames,
          clientResponsibilities: [...service.prerequisites],
          metamagResponsibilities: [...service.deliverables],
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
  ].filter((service, index, all) =>
    all.findIndex((candidate) => candidate.name === service.name) === index,
  );
  const executiveStrengths = summaryItems(executiveSummary.strengths).slice(0, 3);
  const executiveOpportunities = [
    ...summaryItems(executiveSummary.difficulties),
    ...priorityActions.map(({ action }) => action),
  ].filter((item, index, all) =>
    all.findIndex((candidate) => candidate.toLocaleLowerCase('es') === item.toLocaleLowerCase('es')) === index,
  ).slice(0, 3);
  const confirmedFindings = summaryItems(executiveSummary.confirmedFacts);
  const declaredFindings = summaryItems(executiveSummary.declaredFacts);
  const pendingFindings = [
    ...summaryItems(executiveSummary.pendingInformation),
    ...priorityActions
      .filter(({ state }) => state === 'unknown')
      .map(({ dimension, evidenceToConfirm }) => `${dimension}: ${evidenceToConfirm}`),
  ].filter((item, index, all) =>
    all.findIndex((candidate) => candidate.toLocaleLowerCase('es') === item.toLocaleLowerCase('es')) === index,
  ).slice(0, 5);
  const primaryPriority = summaryItems(executiveSummary.priorities)[0]
    ?? executiveOpportunities[0]
    ?? priorityActions[0]?.action
    ?? '';
  const clientAgreements = [
    { title: 'Decisiones acordadas', detail: executiveSummary.advisorDecisions },
    { title: 'Responsabilidades del cliente', detail: executiveSummary.authorResponsibilities },
    { title: 'Responsabilidades de Metamag', detail: executiveSummary.metamagResponsibilities },
    { title: 'Fechas y compromisos', detail: executiveSummary.dates },
  ].filter(({ detail }) => detail.trim());
  const statusLabels: Record<string, string> = {
    recommended_now: 'Recomendado ahora',
    recommended_conditionally: 'Recomendado condicionado',
    recommended_next_stage: 'Para siguiente etapa',
    not_priority: 'No prioritario',
    requires_validation: 'Requiere validación',
  };
  const serviceMap = new Map([
    ['discovery-planning', 'Diagnóstico y planificación'],
    ['content-routine', 'Estrategia editorial y producción de contenido'],
    ['demand-pilot', 'Captación y campaña piloto'],
    ['event-readiness', 'Preparación y entrenamiento para eventos'],
    ['masterclass-production', 'Producción integral de masterclass'],
    ['commercial-followup', 'Seguimiento comercial y medición inicial'],
  ]);
  return {
    clientName: session.clientName,
    organization: session.organization,
    project: session.project,
    meetingDate: session.meetingDate,
    objective: session.objective,
    levelName: result.level?.name ?? 'Evaluación provisional',
    levelFocus: result.level?.focus ?? 'Se requiere completar y validar las seis dimensiones.',
    score: result.score,
    confidence: confidenceLabel(result),
    methodologyVersion: GROWTH_METHODOLOGY_VERSION,
    generatedAt: new Date().toISOString(),
    isExample: form.formId === 'metamag-discovery-demo-2026',
    summaryApproved: session.executiveSummaryApproved === true,
    executiveSummary,
    growthApproved,
    growthClassification,
    growthLevels: GROWTH_LEVELS,
    growthDimensionLevels: GROWTH_DIMENSIONS.map((dimension) => ({
      ...dimension,
      levelName: GROWTH_LEVELS.find((level) =>
        level.id === growthClassification.attainedByDimension[dimension.id],
      )?.name ?? null,
    })),
    growthRequirements: GROWTH_CRITERIA.map((criterion) => {
      const observed = growthEvaluation.criteria[criterion.id];
      return {
        id: criterion.id,
        levelId: criterion.levelId,
        levelName: GROWTH_LEVELS.find((level) => level.id === criterion.levelId)?.name ?? criterion.levelId,
        dimensionName: GROWTH_DIMENSIONS.find((dimension) => dimension.id === criterion.dimensionId)?.name ?? criterion.dimensionId,
        observableBehavior: criterion.observableBehavior,
        evidenceRequired: criterion.evidenceRequired,
        status: observed?.status ?? 'pending',
        state: growthRequirementState(criterion, observed),
        result: observed?.result ?? '',
        evidence: observed?.evidence ?? '',
        justification: observed?.justification ?? '',
        confidence: observed?.confidence ?? 'not_assessed',
      };
    }),
    growthServices,
    coverage: interviewCoverage(questionsForInterview(form, session), session),
    dimensionCoverage: dimensionCoverage(form, questionsForInterview(form, session), session),
    dimensions: form.dimensions.map((dimension) => ({
      name: dimension.name,
      score: session.assessments[dimension.id]?.score ?? null,
      evidence: session.assessments[dimension.id]?.evidence ?? '',
      justification: session.assessments[dimension.id]?.justification ?? '',
    })),
    strengths: form.dimensions.flatMap((dimension) => {
      const assessment = session.assessments[dimension.id];
      return assessment?.score !== null && assessment?.score !== undefined && assessment.score >= 2 && assessment.evidence.trim()
        ? [{ dimensionId: dimension.name, evidence: assessment.evidence }]
        : [];
    }),
    gaps: form.dimensions.flatMap((dimension) => {
      const assessment = session.assessments[dimension.id];
      return assessment?.score !== null && assessment?.score !== undefined && assessment.score <= 1
        ? [{ dimensionId: dimension.name, justification: assessment.justification, critical: assessment.criticalGap }]
        : [];
    }),
    services: Object.values(session.recommendations)
      .filter((recommendation): recommendation is ServiceRecommendation => !!recommendation?.selected)
      .map((recommendation) => ({
        name: serviceMap.get(recommendation.serviceId) ?? recommendation.serviceId,
        status: statusLabels[recommendation.status] ?? recommendation.status,
        justification: recommendation.justification,
      })),
    roadmap: form.maturityModel.levels.map((item) => ({
      name: item.name,
      focus: item.focus,
      requirements: item.progressionRequirements,
    })),
    actions: session.actions,
    executiveConclusion: growthApproved && growthClassification.level
      ? `El proyecto se encuentra en ${growthClassification.level.name}. ${growthClassification.level.description}`
      : 'El nivel de desarrollo sigue pendiente de confirmación; se muestran únicamente hallazgos respaldados y asuntos por resolver.',
    executiveStrengths,
    executiveOpportunities,
    primaryPriority,
    confirmedFindings,
    declaredFindings,
    pendingFindings,
    priorityActions,
    clientServices,
    clientAgreements,
  };
}

export function clientSafeResponse(response: QuestionResponse): Omit<QuestionResponse, 'advisorPrivateNotes'> {
  const { advisorPrivateNotes: _privateNotes, ...safeResponse } = response;
  return safeResponse;
}

function confidenceLabel(result: ReturnType<typeof assessMaturity>): string {
  const label = result.confidence === 'high' ? 'Alta' : result.confidence === 'medium' ? 'Media' : result.confidence === 'low' ? 'Baja' : 'Insuficiente';
  return result.definitive ? label : `${label} (${result.assessedDimensions} de 6 dimensiones evaluadas)`;
}

function summaryItems(value: string): string[] {
  return value
    .split(/\r?\n|[;•]/)
    .map((item) => item.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean);
}
