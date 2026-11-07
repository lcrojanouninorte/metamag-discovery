import { assessMaturity } from './assessment';
import { DiscoverySession, FormDefinition, QuestionResponse, ServiceRecommendation } from './domain';

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
  dimensions: { name: string; score: number | null; evidence: string; justification: string }[];
  strengths: { dimensionId: string; evidence: string }[];
  gaps: { dimensionId: string; justification: string; critical: boolean }[];
  services: { name: string; status: string; justification: string }[];
  roadmap: { name: string; focus: string; requirements: string[] }[];
  actions: DiscoverySession['actions'];
}

export function createClientReport(form: FormDefinition, session: DiscoverySession): ClientReport {
  const result = assessMaturity(form, session.assessments, session.manualLevelId, session.manualLevelJustification);
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
