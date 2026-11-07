export const GROWTH_METHODOLOGY_VERSION = '1.0.0';

export type GrowthLevelId =
  | 'exploracion'
  | 'activacion'
  | 'traccion'
  | 'optimizacion'
  | 'escalamiento';

export type GrowthDimensionId =
  | 'demand'
  | 'content'
  | 'presentation'
  | 'technology'
  | 'commercial'
  | 'sustainability';

export type GrowthCriterionStatus =
  | 'confirmed'
  | 'declared'
  | 'pending'
  | 'not_met'
  | 'not_applicable';

export type GrowthConfidence = 'low' | 'medium' | 'high';

export interface GrowthLevel {
  id: GrowthLevelId;
  name: string;
  order: number;
  description: string;
  benefits: string[];
}

export interface GrowthDimension {
  id: GrowthDimensionId;
  name: string;
}

export interface GrowthCriterion {
  id: string;
  levelId: GrowthLevelId;
  dimensionId: GrowthDimensionId;
  observableBehavior: string;
  evidenceRequired: string;
  auditRule: string;
  mandatory: boolean;
}

export interface GrowthCriterionEvaluation {
  criterionId: string;
  status: GrowthCriterionStatus;
  result: string;
  evidence: string;
  linkedQuestionIds?: string[];
  sourceInvalidated?: boolean;
  justification: string;
  confidence: GrowthConfidence | null;
}

export interface GrowthEvaluation {
  methodologyVersion: string;
  criteria: Record<string, GrowthCriterionEvaluation | undefined>;
}

export interface GrowthGateCounts {
  unmetRequirements: number;
  unknownRequirements: number;
  totalRequirements: number;
}

export interface GrowthClassification {
  methodologyVersion: string;
  status: 'classified' | 'indeterminate' | 'below_foundation';
  level: GrowthLevel | null;
  nextTarget: GrowthLevel | null;
  confidence: GrowthConfidence | 'insufficient';
  nextTargetCounts: GrowthGateCounts;
  attainedByDimension: Record<GrowthDimensionId, GrowthLevelId | null>;
}

export type GrowthPriority = 'high' | 'medium' | 'low';

export interface GrowthResponsibilities {
  client: string[];
  agency: string[];
}

export interface GrowthService {
  id: string;
  name: string;
  problem: string;
  applicableLevelIds: GrowthLevelId[];
  prerequisiteCriteria: string[];
  evidenceBasis: string[];
  deliverables: string[];
  dependencies: string[];
  priority: GrowthPriority;
  responsibilities: GrowthResponsibilities;
  gapCriteria: string[];
  supportCriteria: string[];
}

export interface GrowthPotentialSuggestion {
  service: GrowthService;
  basis: 'documented_gap' | 'next_stage_support';
  levelId: GrowthLevelId;
  criterionIds: string[];
  supportingEvidence: Pick<
    GrowthCriterionEvaluation,
    'criterionId' | 'result' | 'evidence' | 'justification'
  >[];
  rationale: string;
}

const LEVEL_PREFIX: Record<GrowthLevelId, string> = {
  exploracion: 'EXP',
  activacion: 'ACT',
  traccion: 'TRA',
  optimizacion: 'OPT',
  escalamiento: 'ESC',
};

export const GROWTH_LEVELS: readonly GrowthLevel[] = [
  { id: 'exploracion', name: 'Exploración', order: 1, description: 'La propuesta, su audiencia y la operación básica todavía se están delimitando con evidencia inicial.', benefits: ['Aclarar a quién sirve la oferta', 'Reducir supuestos antes de invertir en promoción'] },
  { id: 'activacion', name: 'Activación', order: 2, description: 'Se ejecutan acciones dirigidas y se registran las primeras señales, con responsables y una rutina básica.', benefits: ['Aprender de acciones reales', 'Establecer un flujo inicial de captación y seguimiento'] },
  { id: 'traccion', name: 'Tracción', order: 3, description: 'La ejecución se repite y las decisiones empiezan a apoyarse en señales comparables y aprendizajes documentados.', benefits: ['Identificar qué canales y formatos muestran señales', 'Mejorar la consistencia de entrega y seguimiento'] },
  { id: 'optimizacion', name: 'Optimización', order: 4, description: 'Se prueban mejoras controladas en el proceso y se priorizan recursos con criterios observables.', benefits: ['Detectar fricciones en el recorrido comercial', 'Concentrar recursos en pruebas justificadas'] },
  { id: 'escalamiento', name: 'Escalamiento', order: 5, description: 'La expansión se considera con operación, seguimiento y capacidad sostenibles, más límites y criterios de continuidad.', benefits: ['Planificar expansión sin asumir capacidad ilimitada', 'Definir controles de continuidad y riesgo'] },
];

export const GROWTH_DIMENSIONS: readonly GrowthDimension[] = [
  { id: 'demand', name: 'Audiencia y demanda' },
  { id: 'content', name: 'Comunicación y contenido' },
  { id: 'presentation', name: 'Presentación y facilitación' },
  { id: 'technology', name: 'Tecnología y operación' },
  { id: 'commercial', name: 'Seguimiento comercial' },
  { id: 'sustainability', name: 'Disponibilidad y sostenibilidad' },
];

type CriterionText = Pick<GrowthCriterion, 'observableBehavior' | 'evidenceRequired' | 'auditRule'>;
type LevelCriteria = Record<GrowthDimensionId, CriterionText>;

const CRITERIA_BY_LEVEL: Record<GrowthLevelId, LevelCriteria> = {
  exploracion: {
    demand: {
      observableBehavior: 'Describe un segmento concreto y una necesidad que el producto busca atender.',
      evidenceRequired: 'Perfil de audiencia y ejemplos de conversaciones, consultas o problema observado.',
      auditRule: 'Confirmar segmento y necesidad con ejemplos específicos; una audiencia genérica no pasa.',
    },
    content: {
      observableBehavior: 'Explica el producto con un mensaje comprensible y una llamada a la acción identificable.',
      evidenceRequired: 'Muestra de descripción, publicación, mensaje o material actual del producto.',
      auditRule: 'Revisar una pieza real y verificar que comunica oferta y siguiente paso.',
    },
    presentation: {
      observableBehavior: 'Puede explicar la oferta y responder preguntas básicas sin depender de un guion no disponible.',
      evidenceRequired: 'Demostración breve o guion con preguntas frecuentes y respuestas.',
      auditRule: 'Observar la explicación y registrar si cubre oferta, destinatario y dudas esenciales.',
    },
    technology: {
      observableBehavior: 'Identifica dónde se presenta o entrega el producto y cómo una persona accede a él.',
      evidenceRequired: 'Recorrido de acceso, enlace, plataforma o proceso de entrega vigente.',
      auditRule: 'Probar o inspeccionar el recorrido desde el punto de entrada hasta el acceso.',
    },
    commercial: {
      observableBehavior: 'Describe cómo recibe una consulta y quién responde al interesado.',
      evidenceRequired: 'Ejemplo reciente de consulta y respuesta o flujo de contacto definido.',
      auditRule: 'Verificar un caso concreto o un flujo asignado; ventas reportadas por sí solas no pasan.',
    },
    sustainability: {
      observableBehavior: 'Identifica el tiempo disponible y las responsabilidades para atender actividad básica.',
      evidenceRequired: 'Disponibilidad semanal estimada y responsable de tareas clave.',
      auditRule: 'Contrastar tareas, responsable y tiempo disponible con la operación descrita.',
    },
  },
  activacion: {
    demand: {
      observableBehavior: 'Realiza una acción de captación dirigida a un segmento definido y registra respuestas.',
      evidenceRequired: 'Acción fechada, audiencia objetivo y registro de consultas o respuestas.',
      auditRule: 'Verificar que la actividad llegó al segmento previsto y dejó señales registradas.',
    },
    content: {
      observableBehavior: 'Publica contenido con una frecuencia planificada y un mensaje alineado con la oferta.',
      evidenceRequired: 'Calendario y muestras fechadas de contenido publicado.',
      auditRule: 'Comparar plan y publicaciones de un periodo reciente; una intención sin publicación no pasa.',
    },
    presentation: {
      observableBehavior: 'Realiza una presentación o sesión estructurada con apertura, contenido y cierre.',
      evidenceRequired: 'Grabación, agenda, guion utilizado o retroalimentación de participantes.',
      auditRule: 'Verificar evidencia de ejecución y presencia de las tres partes de la sesión.',
    },
    technology: {
      observableBehavior: 'Configura y prueba el recorrido de registro, acceso o entrega antes de compartirlo.',
      evidenceRequired: 'Prueba documentada del formulario, enlace, plataforma o entrega.',
      auditRule: 'Repetir una prueba de extremo a extremo y registrar fallos y resultado.',
    },
    commercial: {
      observableBehavior: 'Registra interesados y ejecuta al menos un seguimiento con responsable y fecha.',
      evidenceRequired: 'Registro de interesados con estado y ejemplo de seguimiento realizado.',
      auditRule: 'Inspeccionar un caso desde la consulta hasta el seguimiento; no inferirlo de ventas.',
    },
    sustainability: {
      observableBehavior: 'Mantiene una rutina de ejecución compatible con el tiempo y responsables disponibles.',
      evidenceRequired: 'Agenda o bitácora reciente de tareas y responsable asignado.',
      auditRule: 'Comparar rutina planeada con actividades realizadas y capacidad declarada.',
    },
  },
  traccion: {
    demand: {
      observableBehavior: 'Compara señales de demanda por segmento o canal durante más de un periodo.',
      evidenceRequired: 'Registro fechado de consultas, registros o participación desglosado por canal o segmento.',
      auditRule: 'Verificar periodos comparables y fuente de las señales; volumen aislado no demuestra tendencia.',
    },
    content: {
      observableBehavior: 'Ajusta mensajes o formatos usando respuesta observada de la audiencia.',
      evidenceRequired: 'Piezas comparables y registro de interacción o conversión asociado.',
      auditRule: 'Rastrear al menos un cambio de contenido hasta una señal observada que lo motivó.',
    },
    presentation: {
      observableBehavior: 'Repite una sesión o presentación y utiliza retroalimentación para mejorarla.',
      evidenceRequired: 'Agendas o grabaciones de ejecuciones y retroalimentación con cambios registrados.',
      auditRule: 'Comparar ejecuciones e identificar un cambio vinculado a retroalimentación.',
    },
    technology: {
      observableBehavior: 'Opera un flujo digital repetible y revisa incidencias y finalización del recorrido.',
      evidenceRequired: 'Registro de operación, incidencias y datos del flujo de usuarios o participantes.',
      auditRule: 'Revisar datos de más de una ejecución y comprobar cómo se resolvieron incidencias.',
    },
    commercial: {
      observableBehavior: 'Sigue oportunidades con etapas definidas y revisa conversión entre etapas.',
      evidenceRequired: 'Pipeline o registro equivalente con fechas, etapas y resultados.',
      auditRule: 'Tomar una muestra de oportunidades y verificar cambios de etapa respaldados por actividad.',
    },
    sustainability: {
      observableBehavior: 'Distribuye tareas recurrentes entre responsables y revisa carga y cumplimiento.',
      evidenceRequired: 'Asignación de tareas y revisión periódica de capacidad o cumplimiento.',
      auditRule: 'Contrastar responsables y cargas con tareas realizadas en un periodo definido.',
    },
  },
  optimizacion: {
    demand: {
      observableBehavior: 'Prioriza segmentos o canales comparando calidad de demanda y costo o esfuerzo.',
      evidenceRequired: 'Comparativo de segmentos o canales con criterios de calidad y recursos invertidos.',
      auditRule: 'Verificar definiciones comparables y una decisión de prioridad sustentada en el análisis.',
    },
    content: {
      observableBehavior: 'Prueba variantes de contenido y conserva aprendizajes aplicados a la siguiente iteración.',
      evidenceRequired: 'Hipótesis, variantes, resultados observados y decisión posterior.',
      auditRule: 'Confirmar que la comparación tuvo una hipótesis y que el resultado afectó una decisión.',
    },
    presentation: {
      observableBehavior: 'Mide resultados de sesiones y prueba mejoras en estructura o facilitación.',
      evidenceRequired: 'Indicadores de sesión, cambios probados y resultados de ejecuciones comparables.',
      auditRule: 'Vincular una modificación con medidas observadas antes y después.',
    },
    technology: {
      observableBehavior: 'Supervisa indicadores operativos y mejora el flujo a partir de fallos o abandono.',
      evidenceRequired: 'Indicadores de operación y registro de una mejora implementada.',
      auditRule: 'Revisar el indicador, cambio realizado y resultado posterior; una configuración aislada no pasa.',
    },
    commercial: {
      observableBehavior: 'Analiza conversión y tiempos de seguimiento para corregir pérdidas en el proceso.',
      evidenceRequired: 'Métricas por etapa o tiempo de respuesta y una acción de mejora documentada.',
      auditRule: 'Confirmar fuente, periodo y acción vinculada con una brecha medida.',
    },
    sustainability: {
      observableBehavior: 'Ajusta carga, procesos o automatizaciones para sostener resultados con recursos conocidos.',
      evidenceRequired: 'Revisión de capacidad y evidencia de un cambio de proceso o asignación.',
      auditRule: 'Comparar carga y recursos antes y después de un cambio documentado.',
    },
  },
  escalamiento: {
    demand: {
      observableBehavior: 'Amplía adquisición a nuevos segmentos o canales con criterios de validación explícitos.',
      evidenceRequired: 'Plan de expansión, datos de prueba y criterios de continuar, ajustar o detener.',
      auditRule: 'Verificar que la expansión se hizo por etapas y cada etapa tuvo una decisión basada en datos.',
    },
    content: {
      observableBehavior: 'Produce y distribuye contenido en varios canales mediante un sistema editorial repetible.',
      evidenceRequired: 'Flujo editorial, calendario multicanal y métricas de distribución.',
      auditRule: 'Rastrear una pieza a través del proceso y comprobar responsables y métricas.',
    },
    presentation: {
      observableBehavior: 'Entrega sesiones de forma repetible con estándares y capacidad de facilitación distribuida.',
      evidenceRequired: 'Guías de facilitación, registros de sesiones y responsables capacitados.',
      auditRule: 'Verificar consistencia en más de un facilitador o ejecución con criterios definidos.',
    },
    technology: {
      observableBehavior: 'Gestiona capacidad, continuidad y soporte para un aumento previsto de usuarios o actividad.',
      evidenceRequired: 'Pruebas de capacidad, plan de continuidad y responsables de soporte.',
      auditRule: 'Revisar prueba o simulación de carga y comprobar contingencias y responsables.',
    },
    commercial: {
      observableBehavior: 'Opera un proceso comercial replicable con responsables, métricas y transferencia definida.',
      evidenceRequired: 'Procedimiento, métricas y evidencia de ejecución por más de un responsable o periodo.',
      auditRule: 'Comprobar que el proceso se ejecuta sin depender de una única intervención informal.',
    },
    sustainability: {
      observableBehavior: 'Planifica crecimiento de capacidad y recursos con límites y puntos de revisión definidos.',
      evidenceRequired: 'Plan de capacidad, recursos requeridos y umbrales de revisión o pausa.',
      auditRule: 'Contrastar supuestos del plan con capacidad actual y escenarios de crecimiento documentados.',
    },
  },
};

export const GROWTH_CRITERIA: readonly GrowthCriterion[] = GROWTH_LEVELS.flatMap((level) =>
  GROWTH_DIMENSIONS.map((dimension) => {
    const text = CRITERIA_BY_LEVEL[level.id][dimension.id];
    return {
      id: `${LEVEL_PREFIX[level.id]}-${dimension.id.toUpperCase()}`,
      levelId: level.id,
      dimensionId: dimension.id,
      ...text,
      mandatory: true,
    };
  }),
);

export const GROWTH_METHODOLOGY = {
  version: GROWTH_METHODOLOGY_VERSION,
  levels: GROWTH_LEVELS,
  dimensions: GROWTH_DIMENSIONS,
  criteria: GROWTH_CRITERIA,
  rules: [
    'A global level is assigned only when every mandatory criterion at that level and all prior levels is confirmed with result, evidence, and justification.',
    'Criteria are evaluated by dimension; global classification is sequential and never averages dimensions.',
    'Declared, pending, not-applicable, and incomplete evidence do not confirm a requirement.',
    'Sales counts alone cannot satisfy a criterion or determine a level.',
    'Classification is provisional until the advisor reviews and approves it.',
    'Confidence is the lowest confidence among confirmed mandatory criteria through the attained level; missing confidence makes it insufficient.',
  ],
} as const;

function criteriaFor(levelId: GrowthLevelId, dimensionIds: GrowthDimensionId[]): string[] {
  return dimensionIds.map((dimensionId) =>
    `${LEVEL_PREFIX[levelId]}-${dimensionId.toUpperCase()}`,
  );
}

export const GROWTH_SERVICE_CATALOG: readonly GrowthService[] = [
  {
    id: 'audience-and-offer-clarity',
    name: 'Claridad de audiencia y oferta',
    problem: 'El segmento, la necesidad o la oferta no están suficientemente definidos para orientar acciones.',
    applicableLevelIds: ['exploracion'],
    prerequisiteCriteria: [],
    evidenceBasis: ['Conversaciones con audiencia', 'Descripción actual de la oferta'],
    deliverables: ['Perfil de segmento prioritario', 'Propuesta de valor verificable', 'Hipótesis de validación'],
    dependencies: [],
    priority: 'high',
    responsibilities: {
      client: ['Aportar ejemplos de clientes o conversaciones', 'Validar el segmento prioritario'],
      agency: ['Facilitar síntesis de necesidades', 'Documentar hipótesis y criterios de validación'],
    },
    gapCriteria: criteriaFor('exploracion', ['demand', 'content']),
    supportCriteria: [],
  },
  {
    id: 'activation-pilot',
    name: 'Piloto de activación',
    problem: 'Las acciones de captación o comunicación aún no producen señales registradas de forma repetible.',
    applicableLevelIds: ['activacion'],
    prerequisiteCriteria: criteriaFor('exploracion', ['demand', 'content']),
    evidenceBasis: ['Segmento y mensaje validados', 'Registro de ejecución y respuesta'],
    deliverables: ['Plan de campaña piloto', 'Piezas iniciales', 'Registro de señales y aprendizajes'],
    dependencies: ['audience-and-offer-clarity'],
    priority: 'high',
    responsibilities: {
      client: ['Aprobar mensajes y oferta', 'Facilitar accesos y tiempos de revisión'],
      agency: ['Diseñar piloto y medición', 'Analizar señales y proponer siguiente prueba'],
    },
    gapCriteria: criteriaFor('activacion', ['demand', 'content']),
    supportCriteria: criteriaFor('exploracion', ['demand', 'content']),
  },
  {
    id: 'repeatable-delivery',
    name: 'Operación y entrega repetible',
    problem: 'El flujo de entrega, presentación o soporte no está probado de forma consistente.',
    applicableLevelIds: ['traccion'],
    prerequisiteCriteria: criteriaFor('activacion', ['presentation', 'technology', 'sustainability']),
    evidenceBasis: ['Registros de ejecuciones', 'Pruebas del flujo', 'Retroalimentación de participantes'],
    deliverables: ['Procedimiento de operación', 'Guía de sesión', 'Registro de incidencias y mejoras'],
    dependencies: ['activation-pilot'],
    priority: 'medium',
    responsibilities: {
      client: ['Designar responsables operativos', 'Participar en ensayos y revisión'],
      agency: ['Diseñar el flujo y las guías', 'Acompañar pruebas y documentar mejoras'],
    },
    gapCriteria: criteriaFor('traccion', ['presentation', 'technology', 'sustainability']),
    supportCriteria: criteriaFor('activacion', ['presentation', 'technology', 'sustainability']),
  },
  {
    id: 'conversion-optimization',
    name: 'Optimización de conversión',
    problem: 'No se identifican con claridad las pérdidas entre interés, seguimiento y decisión.',
    applicableLevelIds: ['optimizacion'],
    prerequisiteCriteria: criteriaFor('traccion', ['demand', 'commercial']),
    evidenceBasis: ['Datos comparables del proceso', 'Tiempos de seguimiento y conversiones'],
    deliverables: ['Análisis de embudo', 'Experimentos priorizados', 'Tablero de seguimiento'],
    dependencies: ['repeatable-delivery'],
    priority: 'medium',
    responsibilities: {
      client: ['Mantener datos de oportunidades actualizados', 'Aprobar cambios de proceso'],
      agency: ['Analizar embudo y datos', 'Diseñar pruebas y documentar resultados'],
    },
    gapCriteria: criteriaFor('optimizacion', ['demand', 'commercial']),
    supportCriteria: criteriaFor('traccion', ['demand', 'commercial']),
  },
  {
    id: 'scaling-readiness',
    name: 'Preparación para escalar',
    problem: 'La expansión puede superar la capacidad de adquisición, operación o atención disponible.',
    applicableLevelIds: ['escalamiento'],
    prerequisiteCriteria: criteriaFor('optimizacion', ['technology', 'commercial', 'sustainability']),
    evidenceBasis: ['Indicadores operativos y comerciales', 'Plan de capacidad y continuidad'],
    deliverables: ['Plan por etapas', 'Escenarios de capacidad', 'Umbrales de continuidad y pausa'],
    dependencies: ['conversion-optimization'],
    priority: 'low',
    responsibilities: {
      client: ['Definir límites de inversión y capacidad', 'Validar responsables de expansión'],
      agency: ['Modelar escenarios y riesgos', 'Proponer criterios de escalamiento'],
    },
    gapCriteria: criteriaFor('escalamiento', ['technology', 'commercial', 'sustainability']),
    supportCriteria: criteriaFor('optimizacion', ['technology', 'commercial', 'sustainability']),
  },
];

const levelById = new Map(GROWTH_LEVELS.map((level) => [level.id, level] as const));
const criterionById = new Map(GROWTH_CRITERIA.map((criterion) => [criterion.id, criterion] as const));

export function createGrowthEvaluation(): GrowthEvaluation {
  return { methodologyVersion: GROWTH_METHODOLOGY_VERSION, criteria: {} };
}

export function invalidateGrowthEvidenceForQuestions(
  evaluation: GrowthEvaluation,
  changedQuestionIds: ReadonlySet<string>,
): GrowthEvaluation {
  let invalidated = false;
  const criteria = Object.fromEntries(Object.entries(evaluation.criteria).map(([id, criterion]) => {
    if (!criterion?.linkedQuestionIds?.some((questionId) => changedQuestionIds.has(questionId))) {
      return [id, criterion];
    }
    invalidated = true;
    return [id, { ...criterion, status: 'pending' as const, sourceInvalidated: true }];
  }));
  return invalidated ? { ...evaluation, criteria } : evaluation;
}

function hasDocumentedEvidence(
  criterion: GrowthCriterion,
  evaluation: GrowthCriterionEvaluation | undefined,
): evaluation is GrowthCriterionEvaluation {
  return Boolean(
    evaluation &&
    evaluation.criterionId === criterion.id &&
    evaluation.sourceInvalidated !== true &&
    typeof evaluation.result === 'string' &&
    typeof evaluation.evidence === 'string' &&
    typeof evaluation.justification === 'string' &&
    evaluation.result.trim() &&
    evaluation.evidence.trim() &&
    evaluation.justification.trim(),
  );
}

function isConfirmed(
  criterion: GrowthCriterion,
  evaluation: GrowthCriterionEvaluation | undefined,
): boolean {
  return evaluation?.status === 'confirmed' && hasDocumentedEvidence(criterion, evaluation);
}

export function growthRequirementState(
  criterion: GrowthCriterion,
  evaluation: GrowthCriterionEvaluation | undefined,
): 'passed' | 'unmet' | 'unknown' {
  if (evaluation?.status === 'not_met' && hasDocumentedEvidence(criterion, evaluation)) return 'unmet';
  if (isConfirmed(criterion, evaluation)) return 'passed';
  return 'unknown';
}

function countsForLevel(levelId: GrowthLevelId, evaluation: GrowthEvaluation): GrowthGateCounts {
  const requirements = GROWTH_CRITERIA.filter(
    (criterion) => criterion.levelId === levelId && criterion.mandatory,
  );
  const unmetRequirements = requirements.filter(
    (criterion) => growthRequirementState(criterion, evaluation.criteria[criterion.id]) === 'unmet',
  ).length;
  const unknownRequirements = requirements.filter(
    (criterion) => growthRequirementState(criterion, evaluation.criteria[criterion.id]) === 'unknown',
  ).length;
  return {
    unmetRequirements,
    unknownRequirements,
    totalRequirements: requirements.length,
  };
}

export function classifyGrowth(evaluation: GrowthEvaluation): GrowthClassification {
  const compatibleEvaluation: GrowthEvaluation = evaluation.methodologyVersion === GROWTH_METHODOLOGY_VERSION
    ? evaluation
    : { ...evaluation, criteria: {} };
  let attained: GrowthLevel | null = null;
  let target: GrowthLevel | null = null;

  for (const level of GROWTH_LEVELS) {
    const gate = GROWTH_CRITERIA.filter(
      (criterion) => criterion.levelId === level.id && criterion.mandatory,
    );
    if (gate.every((criterion) => isConfirmed(criterion, compatibleEvaluation.criteria[criterion.id]))) {
      attained = level;
      continue;
    }
    target = level;
    break;
  }

  const counts = target
    ? countsForLevel(target.id, compatibleEvaluation)
    : { unmetRequirements: 0, unknownRequirements: 0, totalRequirements: 0 };
  const status: GrowthClassification['status'] = attained
    ? 'classified'
    : counts.unknownRequirements > 0
      ? 'indeterminate'
      : counts.unmetRequirements > 0
        ? 'below_foundation'
        : 'indeterminate';

  const attainedByDimension = Object.fromEntries(GROWTH_DIMENSIONS.map((dimension) => {
    let dimensionLevel: GrowthLevelId | null = null;
    for (const level of GROWTH_LEVELS) {
      const criterion = GROWTH_CRITERIA.find(
        (item) => item.levelId === level.id && item.dimensionId === dimension.id,
      );
      if (!criterion || !isConfirmed(criterion, compatibleEvaluation.criteria[criterion.id])) break;
      dimensionLevel = level.id;
    }
    return [dimension.id, dimensionLevel];
  })) as Record<GrowthDimensionId, GrowthLevelId | null>;
  const confidenceValues = attained
    ? GROWTH_CRITERIA
      .filter((criterion) => criterion.mandatory && levelById.get(criterion.levelId)!.order <= attained!.order)
      .map((criterion) => compatibleEvaluation.criteria[criterion.id]?.confidence ?? null)
    : [];
  const confidence: GrowthClassification['confidence'] = confidenceValues.length === 0 || confidenceValues.includes(null)
    ? 'insufficient'
    : confidenceValues.includes('low')
      ? 'low'
      : confidenceValues.includes('medium')
        ? 'medium'
        : 'high';

  return {
    methodologyVersion: GROWTH_METHODOLOGY_VERSION,
    status,
    level: attained,
    nextTarget: target,
    confidence,
    nextTargetCounts: counts,
    attainedByDimension,
  };
}

export function suggestGrowthPotential(
  evaluation: GrowthEvaluation,
): GrowthPotentialSuggestion[] {
  if (evaluation.methodologyVersion !== GROWTH_METHODOLOGY_VERSION) return [];
  const classification = classifyGrowth(evaluation);
  const targetId = classification.nextTarget?.id;
  if (!targetId) return [];

  return GROWTH_SERVICE_CATALOG.flatMap<GrowthPotentialSuggestion>((service) => {
    if (!service.applicableLevelIds.includes(targetId)) return [];

    const documentedGaps = service.gapCriteria.filter((criterionId) => {
      const criterion = criterionById.get(criterionId);
      const observed = evaluation.criteria[criterionId];
      return Boolean(
        criterion &&
        observed?.status === 'not_met' &&
        hasDocumentedEvidence(criterion, observed),
      );
    });
    if (documentedGaps.length > 0) {
      return [{
        service,
        basis: 'documented_gap' as const,
        levelId: targetId,
        criterionIds: documentedGaps,
        supportingEvidence: documentedGaps.map((criterionId) => {
          const observed = evaluation.criteria[criterionId]!;
          return {
            criterionId,
            result: observed.result,
            evidence: observed.evidence,
            justification: observed.justification,
          };
        }),
        rationale: `Brecha documentada en ${documentedGaps.join(', ')}; validar prioridad y alcance con el cliente.`,
      }];
    }

    const documentedSupport = service.supportCriteria.filter((criterionId) => {
      const criterion = criterionById.get(criterionId);
      const observed = evaluation.criteria[criterionId];
      return Boolean(
        criterion &&
        observed?.status === 'confirmed' &&
        hasDocumentedEvidence(criterion, observed),
      );
    });
    if (documentedSupport.length === 0) return [];

    return [{
      service,
      basis: 'next_stage_support' as const,
      levelId: targetId,
      criterionIds: documentedSupport,
      supportingEvidence: documentedSupport.map((criterionId) => {
        const observed = evaluation.criteria[criterionId]!;
        return {
          criterionId,
          result: observed.result,
          evidence: observed.evidence,
          justification: observed.justification,
        };
      }),
      rationale: `La evidencia confirmada en ${documentedSupport.join(', ')} puede servir de base para explorar apoyo en la siguiente etapa; no implica una necesidad.`,
    }];
  });
}

export function growthCriterionById(id: string): GrowthCriterion | undefined {
  return criterionById.get(id);
}

export function growthLevelById(id: GrowthLevelId): GrowthLevel | undefined {
  return levelById.get(id);
}
