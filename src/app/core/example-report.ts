import {
  createSession,
  DimensionAssessment,
  DiscoverySession,
  FormDefinition,
  emptyResponse,
} from './domain';
import { createGrowthEvaluation, GROWTH_CRITERIA } from './growth-model';

const DEMO_FORM_ID = 'metamag-discovery-demo-2026';

export function createFictionalExampleSession(form: FormDefinition): DiscoverySession {
  if (form.formId !== DEMO_FORM_ID) {
    throw new Error('El informe de ejemplo solo puede crearse con el formulario público de demostración.');
  }

  const growthEvaluation = createGrowthEvaluation();
  const session: DiscoverySession = {
    ...createSession(form, 'Metamag · ejemplo ficticio'),
    clientName: 'Cliente ficticio · ejemplo',
    organization: 'Organización simulada',
    project: 'Caso simulado de producto digital',
    objective: 'Ejemplo ficticio para mostrar cómo se presenta una ruta de crecimiento basada en evidencia.',
    knownState: 'Todos los datos de esta sesión son inventados y no describen a un cliente real.',
    initialNotes: 'EJEMPLO FICTICIO: reemplaza esta sesión por datos verificados antes de compartir cualquier diagnóstico real.',
    interviewMode: 'essential',
    executiveSummary: {
      confirmedFacts: 'Este informe es una simulación; no representa un negocio, una actividad comercial ni resultados reales.',
      declaredFacts: 'En el caso ficticio se reportan publicaciones recientes y consultas de prueba, sin registros reales.',
      inferences: 'En la simulación, podría ser útil probar el flujo de seguimiento; esta inferencia no aplica a un cliente real.',
      strengths: 'En la simulación, la oferta y el flujo de acceso pueden explicarse con ejemplos.',
      difficulties: 'La simulación plantea que todavía no existe seguimiento repetible ni medición por canal.',
      pendingInformation: 'Revisar el origen, fecha y fuente de las señales simuladas antes de usar este ejemplo como plantilla.',
      risksAndDependencies: 'Los datos de ejemplo no deben utilizarse para decidir inversión, campañas ni capacidad real.',
      authorResponsibilities: 'Validar los datos y confirmar disponibilidad para las acciones acordadas.',
      metamagResponsibilities: 'Explorar opciones de apoyo solo después de acordar alcance y evidencia.',
      priorities: 'Probar una acción pequeña y registrar su ejecución antes de ampliar el plan.',
      advisorDecisions: 'Se confirma únicamente que este documento sirve como ejemplo ficticio.',
      nextActions: 'Documentar una conversación y ensayar el recorrido de acceso.',
      dates: 'Fechas omitidas en este ejemplo para evitar aparentar compromisos reales.',
    },
    executiveSummaryApproved: true,
    growthEvaluation,
    growthClassificationApproved: true,
    growthReviewNote: 'Revisión realizada únicamente sobre datos inventados para la demostración.',
    actions: [
      {
        id: crypto.randomUUID(),
        title: 'Registrar una conversación ficticia con una persona del segmento',
        owner: 'Cliente ficticio',
        dueDate: '',
        expectedEvidence: 'Nota simulada con fecha, necesidad observada y fuente',
        status: 'pending',
        priority: 'medium',
        horizon: 7,
      },
      {
        id: crypto.randomUUID(),
        title: 'Probar el flujo de acceso de principio a fin',
        owner: 'Cliente ficticio + asesor',
        dueDate: '',
        expectedEvidence: 'Lista de pasos e incidencias simuladas',
        status: 'pending',
        priority: 'high',
        horizon: 30,
      },
    ],
  };

  const simulatedQuestions = new Set([
    'CTX-01', 'AUD-01', 'AUD-04', 'COM-01', 'MST-01', 'MST-03',
    'SAL-02', 'RES-01', 'CLS-01',
  ]);
  for (const question of form.sections.flatMap((section) => section.questions)) {
    if (!simulatedQuestions.has(question.id)) continue;
    session.responses[question.id] = {
      ...emptyResponse(),
      answer: `EJEMPLO FICTICIO: registro simulado para “${question.text}”. No es evidencia de un cliente real.`,
      evidence: 'Referencia inventada para mostrar el formato del reporte.',
      evidenceLevel: 'specific_report',
      status: 'answered',
    };
  }

  for (const criterion of GROWTH_CRITERIA.filter(({ levelId }) => levelId === 'exploracion')) {
    growthEvaluation.criteria[criterion.id] = {
      criterionId: criterion.id,
      status: 'confirmed',
      result: 'Resultado confirmado únicamente dentro del caso ficticio de demostración.',
      evidence: 'Registro simulado; no representa un documento o evento real.',
      justification: 'Se utiliza como dato de ejemplo para ilustrar el criterio, no como hallazgo de cliente.',
      confidence: 'medium',
    };
  }

  const assessments: Record<string, DimensionAssessment> = {
    demand: {
      score: 2,
      justification: 'Valor ilustrativo para demostrar el formato de la evaluación complementaria.',
      evidence: 'Registro de prueba ficticio.',
      confidence: 'medium',
      state: 'demonstrated',
      criticalGap: false,
    },
    content: {
      score: 1,
      justification: 'Valor ilustrativo; no corresponde a una capacidad real.',
      evidence: 'Ejemplo inventado, pendiente de sustitución por evidencia real.',
      confidence: 'low',
      state: 'insufficient',
      criticalGap: false,
    },
  };
  session.assessments = { ...session.assessments, ...assessments };
  return session;
}
