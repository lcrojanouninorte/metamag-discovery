import { AssessmentResult, FormDefinition, ServiceDefinition, ServiceRecommendation } from './domain';

export const SERVICE_CATALOG: ServiceDefinition[] = [
  {
    id: 'discovery-planning',
    name: 'Diagnóstico y planificación',
    description: 'Aterriza objetivos, alcance, prioridades y decisiones de ejecución.',
    problem: 'Hay objetivos o restricciones que aún requieren definición conjunta.',
    evidence: ['Objetivo declarado', 'Restricciones y prioridades registradas'],
    prerequisites: ['Disponibilidad para validar el alcance'],
    deliverables: ['Plan de trabajo', 'Matriz de responsabilidades'],
    complexity: 'baja',
    dependencies: [],
    duration: '1–2 semanas',
    dimensionIds: ['sustainability'],
  },
  {
    id: 'content-routine',
    name: 'Estrategia editorial y producción de contenido',
    description: 'Organiza mensajes y producción según una rutina sostenible.',
    problem: 'La comunicación no tiene una frecuencia demostrable o depende de producción puntual.',
    evidence: ['Publicaciones recientes', 'Disponibilidad semanal'],
    prerequisites: ['Aprobación de mensajes por la experta'],
    deliverables: ['Pilares editoriales', 'Calendario inicial', 'Piezas acordadas'],
    complexity: 'media',
    dependencies: ['discovery-planning'],
    duration: '3–4 semanas',
    dimensionIds: ['content', 'sustainability'],
  },
  {
    id: 'demand-pilot',
    name: 'Captación y campaña piloto',
    description: 'Prueba un mensaje y canal con medición básica de interesados.',
    problem: 'Las señales de demanda externa o atribución comercial son insuficientes.',
    evidence: ['Consultas y origen de compradores', 'Registro de interesados'],
    prerequisites: ['Oferta y audiencia prioritarias definidas'],
    deliverables: ['Landing o formulario', 'Campaña piloto', 'Reporte de señales'],
    complexity: 'media',
    dependencies: ['content-routine'],
    duration: '4–6 semanas',
    dimensionIds: ['demand', 'commercial'],
  },
  {
    id: 'event-readiness',
    name: 'Preparación y entrenamiento para eventos',
    description: 'Prepara guion, presentación, ensayos y contingencias.',
    problem: 'La experiencia de facilitación o la preparación de la masterclass no está demostrada.',
    evidence: ['Temario o guion disponible', 'Ensayos y experiencia previa'],
    prerequisites: ['Objetivo y duración del evento acordados'],
    deliverables: ['Guion de sesión', 'Ensayo acompañado', 'Lista de verificación'],
    complexity: 'media',
    dependencies: ['discovery-planning'],
    duration: '2–3 semanas',
    dimensionIds: ['presentation'],
  },
  {
    id: 'masterclass-production',
    name: 'Producción integral de masterclass',
    description: 'Coordina preparación técnica y operación en vivo de la masterclass.',
    problem: 'Se requiere realizar el evento sin depender de experiencia técnica interna.',
    evidence: ['Masterclass como objetivo declarado', 'Capacidad técnica evaluada por el asesor'],
    prerequisites: ['Fecha, contenido, plataforma y responsabilidades confirmados'],
    deliverables: ['Prueba técnica', 'Operación del evento', 'Contingencia y seguimiento'],
    complexity: 'alta',
    dependencies: ['event-readiness', 'demand-pilot'],
    duration: '3–6 semanas',
    dimensionIds: ['technology', 'presentation', 'commercial'],
  },
  {
    id: 'commercial-followup',
    name: 'Seguimiento comercial y medición inicial',
    description: 'Establece captura, seguimiento y medición básica de prospectos.',
    problem: 'Las consultas o interacciones no están registradas hasta una decisión.',
    evidence: ['Conversaciones con interesados', 'Registro y atribución actuales'],
    prerequisites: ['Definir responsable de seguimiento y consentimiento de contacto'],
    deliverables: ['Flujo de seguimiento', 'Registro mínimo', 'Indicadores de actividad'],
    complexity: 'baja',
    dependencies: ['demand-pilot'],
    duration: '2–3 semanas',
    dimensionIds: ['commercial', 'demand'],
  },
];

export function recommendServices(
  form: FormDefinition,
  result: AssessmentResult,
): Record<string, ServiceRecommendation> {
  return Object.fromEntries(SERVICE_CATALOG.map((service) => {
    const relevantGaps = result.gaps.filter((gap) => service.dimensionIds.includes(gap.dimensionId));
    const eventNeedsTechnicalSupport = service.id === 'masterclass-production' &&
      result.gaps.some((gap) => gap.dimensionId === 'technology' && gap.score <= 1);
    const status: ServiceRecommendation['status'] = eventNeedsTechnicalSupport
      ? 'recommended_conditionally'
      : relevantGaps.length > 0
        ? 'recommended_now'
        : result.definitive
          ? 'recommended_next_stage'
          : 'requires_validation';
    const justification = relevantGaps.length
      ? `Revisar brecha: ${relevantGaps.map((gap) => form.dimensions.find((dimension) => dimension.id === gap.dimensionId)?.name).filter(Boolean).join(', ')}.`
      : eventNeedsTechnicalSupport
        ? 'La producción delegada puede cubrir una capacidad interna no demostrada; confirmar alcance, ensayos y contingencias.'
        : 'Validar necesidad y prioridad con el cliente antes de incluir en una propuesta.';
    return [service.id, {
      serviceId: service.id,
      status,
      justification,
      selected: status === 'recommended_now' || status === 'recommended_conditionally',
      advisorEdited: false,
    }];
  }));
}

export function serviceById(id: string): ServiceDefinition | undefined {
  return SERVICE_CATALOG.find((service) => service.id === id);
}
