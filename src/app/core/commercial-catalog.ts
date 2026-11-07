import {
  CommercialService,
  CommercialServiceId,
  CommercialRoleId,
  CommercialLevelId,
  ServiceActivity,
  ServiceMetric,
} from './commercial-model';

function activity(
  id: string,
  name: string,
  profileId: CommercialRoleId,
  min: number,
  expected: number,
  max: number,
  assumptions: string[],
  uncertainty: ServiceActivity['uncertainty'] = 'medium',
): ServiceActivity {
  return { id, name, profileId, hours: { min, expected, max }, assumptions, uncertainty };
}

function metrics(serviceName: string): ServiceMetric[] {
  return [
    {
      id: 'delivery', name: 'Entregables completados', kind: 'execution',
      formula: 'Entregables aceptados / entregables contratados',
      source: 'Lista de entregables y acta de aceptación', baseline: 'pending', frequency: 'Al cierre',
      owner: 'Metamag', control: 'metamag', limitation: 'Mide ejecución; no demuestra impacto comercial.',
    },
    {
      id: 'schedule', name: 'Cumplimiento de fechas', kind: 'execution',
      formula: 'Hitos completados a tiempo / hitos acordados',
      source: 'Cronograma aprobado y registro de cambios', baseline: 'pending', frequency: 'Por hito',
      owner: 'Compartido', control: 'shared', limitation: 'Depende de recibir insumos y aprobaciones en las fechas pactadas.',
    },
    {
      id: 'hours', name: 'Horas reales frente a estimadas', kind: 'execution',
      formula: 'Horas registradas comparadas con horas estimadas por actividad',
      source: 'Registro de tiempos del equipo', baseline: 'pending', frequency: 'Semanal y al cierre',
      owner: 'Metamag', control: 'metamag', limitation: 'Las estimaciones iniciales tienen incertidumbre y pueden cambiar con el alcance.',
    },
    {
      id: 'acceptance', name: 'Criterios de aceptación cumplidos', kind: 'quality',
      formula: 'Criterios verificados / criterios acordados',
      source: 'Lista de aceptación y pruebas de calidad', baseline: 'pending', frequency: 'Por entrega',
      owner: 'Metamag', control: 'metamag', limitation: 'La aceptación del cliente requiere revisión dentro del plazo acordado.',
    },
    {
      id: 'quality-approval', name: 'Aprobación del cliente', kind: 'quality',
      formula: 'Entregables aprobados / entregables presentados',
      source: 'Registro escrito de revisión', baseline: 'pending', frequency: 'Por entrega',
      owner: 'Cliente', control: 'shared', limitation: 'No equivale a un resultado de ventas.',
    },
    {
      id: 'leads', name: 'Consultas o leads registrados', kind: 'commercial',
      formula: 'Conteo de consultas únicas según definición acordada',
      source: 'CRM, formulario o registro de consultas; requiere línea base y atribución disponibles',
      baseline: 'pending', frequency: 'Semanal durante la medición',
      owner: 'Compartido', control: 'external',
      limitation: `Indicador opcional para ${serviceName}; volumen depende de audiencia, oferta, inversión y seguimiento. No se garantiza.`,
    },
    {
      id: 'sales', name: 'Ventas atribuibles', kind: 'commercial',
      formula: 'Compras con fuente atribuible / total de compras del periodo',
      source: 'Registros de ventas y fuente de adquisición verificable',
      baseline: 'pending', frequency: 'Al cierre del periodo acordado',
      owner: 'Cliente', control: 'external',
      limitation: 'Solo se reporta si existe seguimiento y atribución confiables; no se prometen ventas.',
    },
  ];
}

function makeService(input: {
  id: CommercialServiceId;
  name: string;
  description: string;
  category: string;
  levels: CommercialLevelId[];
  problem: string;
  evidence: string[];
  objective: string;
  activities: string[];
  deliverable: string;
  quantity: number;
  format: string;
  acceptance: string;
  duration: [number, number, number];
  revisions: number;
  exclusions: string[];
  client: string[];
  metamag: string[];
  responsibility: CommercialService['responsibilities'];
  estimate: ServiceActivity[];
  dependencies: string[];
  risks: string[];
  recurring?: boolean;
  discountEligible?: boolean;
}): CommercialService {
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    category: input.category,
    relatedLevels: input.levels,
    problem: input.problem,
    evidenceBasis: input.evidence,
    objective: input.objective,
    activities: input.activities,
    deliverables: [{
      id: `${input.id}-deliverable`,
      name: input.deliverable,
      quantity: input.quantity,
      format: input.format,
      acceptanceCriteria: input.acceptance,
    }],
    revisionsIncluded: input.revisions,
    calendarDuration: { minDays: input.duration[0], expectedDays: input.duration[1], maxDays: input.duration[2] },
    exclusions: input.exclusions,
    clientResponsibilities: input.client,
    metamagResponsibilities: input.metamag,
    responsibilities: input.responsibility,
    activitiesEstimate: input.estimate,
    dependencies: input.dependencies,
    risks: input.risks,
    metrics: metrics(input.name),
    recurring: input.recurring ?? false,
    discountEligible: input.discountEligible ?? true,
    defaultQuantity: 1,
  };
}

const service = (name: string, lead: 'client' | 'metamag' | 'shared', clientContribution: string, metamagContribution: string, dependency: string, acceptanceCriteria: string, state: 'included' | 'optional' | 'excluded' | 'pending' = 'included') => ({
  activity: name, lead, clientContribution, metamagContribution, dependency, acceptanceCriteria, state,
});

export const COMMERCIAL_SERVICES: CommercialService[] = [
  makeService({
    id: 'commercial-diagnosis', name: 'Diagnóstico y plan comercial de 30 días',
    description: 'Análisis consultivo y plan de acciones priorizadas; no incluye ejecución de campañas.',
    category: 'Estrategia', levels: ['exploracion', 'activacion'],
    problem: 'Falta de prioridades comerciales documentadas y próximos pasos accionables.',
    evidence: ['Objetivos y acciones actuales documentados', 'Evidencias disponibles sobre audiencia, canal y seguimiento', 'Brechas confirmadas en entrevista'],
    objective: 'Entregar una síntesis de situación, prioridades y plan de trabajo para los siguientes 30 días.',
    activities: ['Revisar insumos acordados', 'Realizar sesión de descubrimiento', 'Analizar evidencias y restricciones', 'Priorizar acciones y dependencias', 'Presentar y ajustar el plan'],
    deliverable: 'Plan comercial de 30 días y sesión de devolución', quantity: 1, format: 'Documento digital y sesión virtual de hasta 60 minutos',
    acceptance: 'Incluye situación observada, prioridades justificadas, acciones con responsable y fecha sugerida, supuestos y pendientes de validar.',
    duration: [7, 12, 18], revisions: 1,
    exclusions: ['Implementación de acciones', 'Investigación de mercado estadística', 'Garantía de ventas o resultados comerciales'],
    client: ['Entregar información comercial disponible y señalar datos no confirmados', 'Asistir a una sesión de hasta 90 minutos', 'Revisar el borrador y responder dentro de cinco días hábiles'],
    metamag: ['Facilitar la sesión', 'Analizar los insumos recibidos', 'Preparar el plan y explicar sus supuestos'],
    responsibility: [
      service('Entrega de información comercial', 'client', 'Datos y documentos disponibles; puede marcar información como no confirmada.', 'Plantilla de insumos y preguntas de aclaración.', 'Previo a la sesión', 'Insumos recibidos o pendientes registrados.'),
      service('Sesión de descubrimiento', 'shared', 'Participación de las personas clave y contexto del negocio.', 'Facilitación y registro de acuerdos.', 'Fecha coordinada', 'Objetivos, hechos y pendientes documentados.'),
      service('Plan y devolución', 'metamag', 'Revisión del borrador dentro del plazo.', 'Análisis, documento digital y devolución virtual.', 'Con insumos completos', 'Plan contiene prioridades, responsables y acciones verificables.'),
    ],
    estimate: [
      activity('discovery', 'Descubrimiento y revisión de requisitos', 'strategist', 2, 3, 5, ['Hasta una unidad de negocio o producto.']),
      activity('analysis', 'Análisis de información y evidencias', 'strategist', 3, 5, 8, ['Información suministrada por el cliente.']),
      activity('planning', 'Priorización y plan de acciones', 'strategist', 3, 4, 6, ['Plan limitado a 30 días; no incluye implementación.']),
      activity('meeting', 'Reuniones de trabajo y devolución', 'project_manager', 1.5, 2, 3, ['Una sesión de descubrimiento y una devolución.']),
      activity('review', 'Revisión y ajuste', 'strategist', 1, 1.5, 3, ['Una ronda de revisión consolidada.']),
      activity('documentation', 'Documentación y QA', 'qa_specialist', 1, 1.5, 2, ['Documento digital estándar.']),
    ],
    dependencies: ['Disponibilidad de la persona responsable', 'Entrega de información comercial acordada'],
    risks: ['Datos incompletos pueden limitar las recomendaciones', 'Las prioridades pueden cambiar si cambia la oferta o capacidad operativa'],
  }),
  makeService({
    id: 'content-strategy', name: 'Estrategia de contenidos y calendario mensual',
    description: 'Definición de pilares editoriales y calendario de contenido para un mes.',
    category: 'Contenido', levels: ['activacion', 'traccion'],
    problem: 'Comunicación sin prioridades, consistencia o planificación editorial.',
    evidence: ['Canales usados y frecuencia observada', 'Preguntas recurrentes de audiencia', 'Objetivo de comunicación acordado'],
    objective: 'Organizar contenidos alineados con audiencia, oferta y capacidad real de producción.',
    activities: ['Alinear objetivo y audiencia', 'Definir pilares y mensajes', 'Diseñar calendario de un mes', 'Especificar formatos y llamados a la acción', 'Revisar y entregar'],
    deliverable: 'Estrategia editorial y calendario mensual', quantity: 1, format: 'Hoja de cálculo o documento digital',
    acceptance: 'Incluye pilares, propósito, formato, tema, fecha sugerida y llamado a la acción por pieza; no implica publicación.',
    duration: [7, 12, 18], revisions: 1,
    exclusions: ['Diseño o producción de piezas', 'Publicación y respuesta a mensajes', 'Investigación cuantitativa de audiencia', 'Resultados de alcance o ventas garantizados'],
    client: ['Aportar oferta, insumos de marca y conocimiento del público', 'Confirmar capacidad de producción y canales', 'Aprobar calendario'],
    metamag: ['Facilitar alineación estratégica', 'Proponer pilares y calendario', 'Explicitar supuestos y formatos'],
    responsibility: [
      service('Brief editorial', 'client', 'Oferta, marca, audiencia conocida y prioridades.', 'Guía de preguntas y síntesis de brief.', 'Antes de planificar', 'Brief validado o pendientes señalados.'),
      service('Calendario mensual', 'metamag', 'Revisión de temas y capacidad de producción.', 'Estrategia, calendario y llamados a la acción.', 'Con brief validado', 'Cada entrada contiene fecha sugerida, tema, formato y propósito.'),
    ],
    estimate: [
      activity('discovery', 'Descubrimiento y brief', 'strategist', 1.5, 2.5, 4, ['Un producto, público principal y canales acordados.']),
      activity('strategy', 'Pilares, mensajes y enfoque', 'strategist', 2, 3, 5, ['No incluye investigación primaria.']),
      activity('calendar', 'Calendario mensual', 'copywriter', 3, 4.5, 7, ['Hasta 12 ideas editoriales; cantidades finales acordadas en propuesta.']),
      activity('meeting', 'Reuniones de trabajo', 'project_manager', 1, 1.5, 2.5, ['Una sesión de alineación.']),
      activity('review', 'Revisión', 'strategist', 1, 1.5, 2.5, ['Una ronda consolidada.']),
      activity('documentation', 'QA y entrega', 'qa_specialist', 0.75, 1, 1.5, ['Validación de consistencia del documento.']),
    ],
    dependencies: ['Brief y oferta disponibles', 'Revisión oportuna por el cliente'],
    risks: ['La estrategia debe ajustarse si cambian la oferta, el calendario o los canales'],
  }),
  makeService({
    id: 'social-design', name: 'Diseño de ocho piezas para redes sociales',
    description: 'Diseño de piezas estáticas o carruseles breves a partir de brief y recursos aprobados.',
    category: 'Contenido', levels: ['activacion', 'traccion'],
    problem: 'Necesidad de recursos gráficos consistentes para comunicación digital.',
    evidence: ['Canales y formatos confirmados', 'Mensajes y oferta aprobados', 'Disponibilidad de recursos de marca'],
    objective: 'Producir ocho piezas listas para los formatos y canales acordados.',
    activities: ['Ajustar brief y formatos', 'Organizar textos y recursos', 'Diseñar piezas', 'Revisar consistencia y exportaciones', 'Entregar y registrar aprobación'],
    deliverable: 'Piezas gráficas para redes', quantity: 8, format: 'PNG/JPG; carrusel y dimensiones se acuerdan antes de iniciar',
    acceptance: 'Ocho archivos exportados en formatos acordados, textos revisados y cumplimiento del brief aprobado.',
    duration: [8, 14, 22], revisions: 2,
    exclusions: ['Fotografía o ilustración original compleja', 'Compra de recursos/licencias', 'Publicación o moderación', 'Piezas adicionales o cambios de brief'],
    client: ['Entregar logos, guía de marca, imágenes y textos aprobados', 'Definir canales, formatos y prioridad', 'Consolidar comentarios por ronda'],
    metamag: ['Diseñar ocho piezas conforme al brief', 'Revisar legibilidad y exportar archivos', 'Entregar archivos finales acordados'],
    responsibility: [
      service('Insumos y aprobación de contenido', 'client', 'Textos, recursos licenciados y guía de marca.', 'Plantilla de brief y revisión de requisitos.', 'Antes del diseño', 'Insumos completos y textos autorizados.'),
      service('Diseño y exportación', 'metamag', 'Comentarios consolidados por hasta dos rondas.', 'Diseño, ajustes incluidos, QA y exportación.', 'Con brief aprobado', 'Ocho piezas en dimensiones y formatos acordados.'),
      service('Publicación', 'client', 'Acceso y gestión de los canales.', 'Recomendaciones de formato, si se acuerdan.', 'Posterior a entrega', 'No aplica: publicación excluida.', 'excluded'),
    ],
    estimate: [
      activity('brief', 'Brief, formatos y revisión de insumos', 'project_manager', 1, 1.5, 2.5, ['Un brief consolidado.']),
      activity('copy', 'Adaptación de textos', 'copywriter', 1.5, 2.5, 4, ['Cliente aporta mensajes base aprobados.']),
      activity('design', 'Diseño de ocho piezas', 'designer', 8, 12, 18, ['Complejidad gráfica estándar; se reutilizan lineamientos aprobados.']),
      activity('review', 'Rondas de ajustes', 'designer', 2, 3.5, 6, ['Hasta dos rondas consolidadas.']),
      activity('qa', 'QA y exportación', 'qa_specialist', 1, 1.5, 2.5, ['Archivos digitales para canales acordados.']),
      activity('management', 'Gestión y entrega', 'project_manager', 1, 1.5, 2.5, ['Coordinación asíncrona estándar.']),
    ],
    dependencies: ['Brief, textos y recursos disponibles', 'Aprobación de formatos antes de diseñar'],
    risks: ['Cambios de contenido después de aprobar el brief pueden afectar horas y fechas'],
  }),
  makeService({
    id: 'short-video-editing', name: 'Edición de cuatro videos cortos con material suministrado',
    description: 'Edición de cuatro videos cortos utilizando material original entregado por el cliente.',
    category: 'Audiovisual', levels: ['activacion', 'traccion'],
    problem: 'Material audiovisual disponible sin edición lista para difusión.',
    evidence: ['Existencia y estado del material original', 'Duraciones y formatos acordados', 'Lineamientos de marca y canal definidos'],
    objective: 'Entregar cuatro videos editados y exportados a partir de material suministrado.',
    activities: ['Revisar material y especificaciones', 'Definir estructura por video', 'Editar y subtitular según alcance', 'Revisar y exportar'],
    deliverable: 'Videos cortos editados', quantity: 4, format: 'MP4 vertical; duración y subtítulos definidos en el brief',
    acceptance: 'Cuatro archivos reproducibles, con duración, formato y elementos aprobados conforme al brief.',
    duration: [8, 14, 24], revisions: 2,
    exclusions: ['Grabación presencial o remota', 'Locución, música o material licenciado no suministrado', 'Animación avanzada', 'Guion de contenido intelectual no acordado'],
    client: ['Aportar material original, lineamientos, logos y textos aprobados', 'Confirmar derechos y autorizaciones de imagen/sonido', 'Consolidar comentarios por ronda'],
    metamag: ['Revisar material', 'Editar, ajustar y exportar cuatro videos', 'Realizar QA técnico de los archivos'],
    responsibility: [
      service('Material original y lineamientos', 'client', 'Videos originales, lineamientos, logos, textos y autorizaciones.', 'Revisión de legibilidad técnica y lista de requisitos.', 'Antes de edición', 'Archivos accesibles y derechos/autorizaciones confirmados.'),
      service('Edición, ajustes y exportación', 'metamag', 'Comentarios consolidados en hasta dos rondas.', 'Edición, ajustes acordados, subtítulos incluidos si se definen y exportación.', 'Con material aprobado', 'Cuatro videos en especificaciones acordadas.'),
      service('Grabación presencial', 'client', 'Contratación adicional si se requiere.', 'No incluida en este servicio.', 'Pendiente de contratación adicional', 'Ninguna; excluida salvo acuerdo y presupuesto separado.', 'excluded'),
    ],
    estimate: [
      activity('ingest', 'Recepción y revisión de material', 'video_editor', 1, 1.5, 3, ['Material organizado y con calidad suficiente.']),
      activity('structure', 'Estructura y preparación', 'strategist', 1, 2, 3, ['Cliente provee contenido y lineamientos temáticos.']),
      activity('edit', 'Edición de cuatro videos', 'video_editor', 8, 12, 20, ['Complejidad estándar y material suministrado.']),
      activity('captions', 'Subtítulos y elementos gráficos acordados', 'video_editor', 2, 3, 5, ['Idioma principal español; recursos proporcionados o tipográficos.']),
      activity('review', 'Revisión y ajustes', 'video_editor', 2, 3, 6, ['Hasta dos rondas consolidadas.']),
      activity('qa', 'QA, exportación y entrega', 'qa_specialist', 1, 1.5, 2.5, ['Un formato principal por pieza.']),
      activity('management', 'Gestión y documentación', 'project_manager', 1, 1.5, 2.5, ['Entrega de archivos finales por enlace acordado.']),
    ],
    dependencies: ['Material original utilizable y organizado', 'Derechos de uso y autorizaciones', 'Comentarios consolidados'],
    risks: ['Material incompleto, dañado o de baja resolución puede requerir ajustes de alcance'],
  }),
  makeService({
    id: 'landing-page', name: 'Landing page básica',
    description: 'Diseño e implementación de una página de aterrizaje informativa con formulario básico.',
    category: 'Desarrollo digital', levels: ['activacion', 'traccion'],
    problem: 'Falta de una página de destino clara para presentar una oferta y captar interés.',
    evidence: ['Oferta, objetivo y llamado a la acción definidos', 'Textos, fotos y autorizaciones disponibles', 'Accesos y requisitos de integración confirmados'],
    objective: 'Publicar una landing responsive con contenido y formulario acordados.',
    activities: ['Descubrir requisitos', 'Definir estructura y contenido', 'Diseñar interfaz', 'Implementar la página y formulario', 'Probar responsive y publicar'],
    deliverable: 'Landing page básica publicada o entregada en entorno acordado', quantity: 1, format: 'URL responsive; stack e integraciones acordados antes de inicio',
    acceptance: 'Secciones acordadas visibles, enlaces y formulario probados, comportamiento responsive verificado en navegadores acordados.',
    duration: [15, 25, 40], revisions: 2,
    exclusions: ['Dominio, hosting, suscripciones y licencias', 'Redacción legal o políticas', 'Fotografía y producción audiovisual', 'Integraciones pagas o complejas', 'Mantenimiento posterior al periodo de garantía acordado'],
    client: ['Aportar información, textos o insumos definidos, fotografías y autorizaciones', 'Entregar accesos necesarios con permisos adecuados', 'Aprobar contenido y diseño dentro del plazo acordado', 'Cubrir dominio, hosting y suscripciones'],
    metamag: ['Diseñar e implementar la landing', 'Configurar formulario e integración acordados', 'Realizar pruebas responsive, QA y publicación/transferencia', 'Documentar accesos y operación acordada'],
    responsibility: [
      service('Contenido, fotografías y autorizaciones', 'client', 'Información, textos o insumos definidos, fotografías, autorizaciones y aprobación.', 'Estructura, guía de requisitos y carga de insumos recibidos.', 'Antes de implementación', 'Contenido autorizado y aprobado por cliente.'),
      service('Diseño, implementación y pruebas', 'metamag', 'Revisión funcional y comentarios consolidados.', 'Diseño, desarrollo, formulario e integración básica acordada, QA responsive.', 'Con contenido y accesos', 'Secciones y funcionalidades acordadas pasan checklist de aceptación.'),
      service('Dominio, hosting y suscripciones', 'client', 'Compra, titularidad y renovación de servicios externos.', 'Requisitos técnicos y apoyo de configuración acordado.', 'Antes de publicación', 'Servicios externos activos y accesos disponibles.', 'excluded'),
      service('Publicación y transferencia', 'shared', 'Aprobación final y accesos requeridos.', 'Publicación en entorno acordado, documentación y transferencia.', 'Luego de pruebas aprobadas', 'URL o archivos entregados y funcionamiento verificado.'),
    ],
    estimate: [
      activity('discovery', 'Descubrimiento y requisitos', 'strategist', 2, 3, 5, ['Una oferta, una audiencia principal y formulario básico.']),
      activity('structure', 'Estructura y contenido', 'copywriter', 2, 4, 7, ['Cliente aporta información y textos/insumos; redacción extensa no incluida.']),
      activity('design', 'Diseño de interfaz', 'designer', 3, 5, 8, ['Diseño de una página responsive, sin animación avanzada.']),
      activity('implementation', 'Implementación web', 'web_developer', 6, 10, 16, ['Stack simple y entorno de publicación acordado.']),
      activity('form', 'Formulario e integración básica', 'web_developer', 1.5, 3, 6, ['Una integración estándar; licencias externas aparte.']),
      activity('responsive', 'Pruebas responsive', 'qa_specialist', 1.5, 2.5, 4, ['Resoluciones y navegadores principales acordados.']),
      activity('qa', 'QA funcional y correcciones', 'qa_specialist', 1.5, 2.5, 4, ['Dos rondas de revisión visual/funcional incluidas.']),
      activity('publish', 'Publicación', 'web_developer', 1, 2, 4, ['Accesos de hosting y dominio proporcionados por el cliente.']),
      activity('documentation', 'Documentación y transferencia', 'project_manager', 1, 1.5, 3, ['Documentación básica de operación.']),
      activity('management', 'Gestión y reuniones', 'project_manager', 2, 3, 5, ['Reuniones y coordinaciones del proyecto.']),
    ],
    dependencies: ['Contenido aprobado', 'Accesos técnicos disponibles', 'Dominio, hosting y suscripciones contratados por el cliente'],
    risks: ['Integraciones no definidas, cambios de contenido o retrasos de accesos amplían esfuerzo y calendario'],
  }),
  makeService({
    id: 'crm-setup', name: 'Configuración básica de CRM',
    description: 'Configuración inicial de un CRM existente para organizar contactos y etapas comerciales.',
    category: 'Operaciones', levels: ['traccion', 'optimizacion'],
    problem: 'Seguimiento comercial disperso o sin etapas y campos acordados.',
    evidence: ['Herramienta CRM seleccionada o acceso disponible', 'Proceso comercial y responsables descritos', 'Campos y fuentes de contactos definidos'],
    objective: 'Configurar un flujo básico y capacitar responsables en su uso.',
    activities: ['Levantar proceso actual', 'Acordar etapas y campos', 'Configurar pipeline', 'Probar registros y permisos', 'Capacitar y documentar'],
    deliverable: 'CRM básico configurado y guía de uso', quantity: 1, format: 'Instancia existente y documento digital',
    acceptance: 'Pipeline, campos y permisos acordados están configurados; casos de prueba registrados; responsables reciben capacitación.',
    duration: [8, 15, 25], revisions: 1,
    exclusions: ['Licencias y suscripciones', 'Migración o limpieza masiva de datos', 'Desarrollos a medida', 'Integraciones complejas', 'Garantía de conversión comercial'],
    client: ['Aportar licencias, accesos, proceso, campos y responsables', 'Validar tratamiento y permisos de datos', 'Participar en capacitación y mantener registros'],
    metamag: ['Documentar requisitos', 'Configurar estructura básica acordada', 'Probar flujos, documentar y capacitar'],
    responsibility: [
      service('Proceso, datos y accesos', 'client', 'Proceso comercial, licencias, permisos, campos e información autorizada.', 'Guía de levantamiento y recomendaciones de configuración.', 'Antes de configuración', 'Proceso y accesos confirmados.'),
      service('Configuración y pruebas', 'metamag', 'Validación de casos y permisos.', 'Pipeline, campos, roles básicos y pruebas de aceptación.', 'Con requisitos acordados', 'Casos de prueba definidos pasan en la herramienta.'),
      service('Uso continuo y seguimiento', 'client', 'Registro y mantenimiento de datos tras la entrega.', 'Capacitación y guía de uso.', 'Posterior a entrega', 'Responsables capacitados; adopción y ventas no garantizadas.'),
    ],
    estimate: [
      activity('discovery', 'Descubrimiento del proceso', 'automation_specialist', 2, 3, 5, ['Un proceso comercial sencillo.']),
      activity('design', 'Diseño de etapas y campos', 'strategist', 1.5, 2.5, 4, ['Sin automatizaciones complejas.']),
      activity('setup', 'Configuración de CRM', 'automation_specialist', 3, 5, 9, ['CRM con funciones estándar y licencias activas.']),
      activity('testing', 'Pruebas funcionales y permisos', 'qa_specialist', 1.5, 2.5, 4, ['Cliente participa en validación.']),
      activity('training', 'Capacitación', 'automation_specialist', 1, 1.5, 2.5, ['Una sesión virtual.']),
      activity('documentation', 'Documentación y transferencia', 'qa_specialist', 1, 1.5, 2.5, ['Guía de uso inicial.']),
      activity('management', 'Gestión y coordinación', 'project_manager', 1, 1.5, 2.5, ['Una ronda de ajuste posterior a pruebas.']),
    ],
    dependencies: ['CRM elegido y licencias activas', 'Proceso y accesos del cliente', 'Permisos para datos personales revisados por el cliente'],
    risks: ['Limitaciones de licencias pueden impedir funciones esperadas', 'Datos desorganizados pueden requerir un proyecto adicional'],
  }),
  makeService({
    id: 'masterclass-support', name: 'Preparación y acompañamiento de masterclass virtual',
    description: 'Diseño operativo, ensayo y soporte técnico para una masterclass virtual.',
    category: 'Eventos', levels: ['activacion', 'traccion'],
    problem: 'Evento virtual sin preparación operativa, ensayo o mecanismo claro de inscripción.',
    evidence: ['Tema, ponente y fecha tentativa confirmados', 'Herramienta y equipo técnico identificados', 'Objetivo e inscripción/seguimiento definidos'],
    objective: 'Preparar una sesión virtual y acompañar su ejecución técnica dentro del alcance acordado.',
    activities: ['Alinear objetivo y formato', 'Diseñar agenda y guion operativo', 'Verificar herramienta y registro', 'Ensayar', 'Acompañar evento y registrar incidencias'],
    deliverable: 'Guion operativo, ensayo y soporte para una masterclass', quantity: 1, format: 'Sesión virtual de hasta 90 minutos; preparación digital',
    acceptance: 'Agenda, roles y checklist aprobados; ensayo realizado; soporte técnico dentro de la ventana acordada.',
    duration: [10, 18, 30], revisions: 1,
    exclusions: ['Desarrollo del contenido intelectual del libro', 'Honorarios del ponente', 'Plataforma pagada, pauta, edición posterior o transmisión presencial', 'Garantía de inscripciones, asistencia o ventas'],
    client: ['Aportar contenido temático y participar como ponente', 'Confirmar fecha, disponibilidad, audiencia y recursos', 'Proveer accesos y aprobar agenda', 'Realizar invitación y seguimiento salvo contratación adicional'],
    metamag: ['Aportar estructura, asesoría y guion operativo', 'Realizar ensayo y soporte técnico según alcance contratado', 'Entregar checklist y registro de incidencias acordado'],
    responsibility: [
      service('Contenido temático y ponencia', 'client', 'Cliente aporta contenido temático, disponibilidad y participación como ponente.', 'Asesoría de estructura y orden operativo; no autoría intelectual del libro.', 'Antes del ensayo', 'Tema y participación confirmados; contenido sigue bajo responsabilidad del cliente.'),
      service('Agenda, ensayo y soporte', 'shared', 'Ponente asiste al ensayo y evento; comparte presentación y accesos.', 'Estructura, asesoría, ensayo y soporte técnico en ventana acordada.', 'Fecha y plataforma confirmadas', 'Checklist acordado completado y ensayo realizado.'),
      service('Convocatoria y seguimiento comercial', 'client', 'Invitaciones, base de contactos, seguimiento y permisos.', 'No incluido salvo selección explícita de otro servicio.', 'Antes y después del evento', 'Actividad excluida de este alcance.', 'excluded'),
    ],
    estimate: [
      activity('discovery', 'Descubrimiento y requisitos del evento', 'event_producer', 2, 3, 5, ['Un evento, una plataforma y un ponente principal.']),
      activity('structure', 'Estructura y guion operativo', 'strategist', 2, 3.5, 6, ['Cliente aporta contenido intelectual temático.']),
      activity('setup', 'Configuración y verificación técnica', 'event_producer', 2, 3.5, 6, ['Herramienta y licencias disponibles.']),
      activity('rehearsal', 'Ensayo', 'event_producer', 1.5, 2, 3, ['Un ensayo con ponente y equipo clave.']),
      activity('event', 'Soporte durante el evento', 'event_producer', 2, 2.5, 4, ['Una sesión de hasta 90 minutos y ventana técnica acordada.']),
      activity('qa', 'Pruebas y checklist', 'qa_specialist', 1, 1.5, 2.5, ['Prueba de audio, video, acceso y roles.']),
      activity('management', 'Gestión y coordinación', 'project_manager', 1.5, 2.5, 4, ['Coordinación con el equipo del cliente.']),
    ],
    dependencies: ['Ponente y contenido del cliente', 'Disponibilidad y acceso a plataforma', 'Fecha y condiciones técnicas confirmadas'],
    risks: ['Fallas de internet/plataforma de terceros', 'Cambios de fecha, ponente o contenido pueden afectar el plan'],
  }),
  makeService({
    id: 'ad-campaign-management', name: 'Gestión de campaña publicitaria durante 30 días',
    description: 'Configuración, monitoreo y optimización operativa de una campaña en una plataforma acordada.',
    category: 'Publicidad', levels: ['traccion', 'optimizacion', 'escalamiento'],
    problem: 'Necesidad de administrar pauta con objetivos, medición y revisión definidos.',
    evidence: ['Oferta y destino de campaña listos', 'Cuenta publicitaria, permisos y medición disponibles', 'Presupuesto externo y responsable de atención acordados'],
    objective: 'Gestionar una campaña durante 30 días con seguimiento y reporte de métricas disponibles.',
    activities: ['Definir objetivo, audiencia y evento de medición', 'Preparar configuración y creatividades disponibles', 'Configurar campaña', 'Monitorear y ajustar', 'Reportar resultados y limitaciones'],
    deliverable: 'Gestión de una campaña y reporte de periodo', quantity: 1, format: 'Una plataforma publicitaria; reporte digital al cierre de 30 días',
    acceptance: 'Configuración revisada, seguimiento documentado y reporte con métricas disponibles, fuente y limitaciones.',
    duration: [30, 35, 45], revisions: 1,
    exclusions: ['Presupuesto de pauta y cargos de plataforma', 'Producción de piezas no contratadas', 'Landing page, CRM o respuesta a leads', 'Garantía de alcance, leads, conversiones o ventas'],
    client: ['Aportar presupuesto de pauta aparte y método de pago', 'Entregar accesos y permisos de cuenta', 'Aprobar oferta, creatividades y segmentación', 'Atender consultas y compartir ventas atribuibles si las mide'],
    metamag: ['Definir configuración acordada', 'Monitorear y ajustar en periodo contratado', 'Informar ejecución y métricas disponibles sin prometer resultados'],
    responsibility: [
      service('Cuenta, presupuesto y aprobación', 'client', 'Acceso autorizado, método de pago, presupuesto de pauta, oferta y aprobaciones.', 'Checklist de requisitos y configuración acordada.', 'Antes del lanzamiento', 'Cuenta activa, presupuesto confirmado y anuncios aprobados.'),
      service('Gestión de campaña', 'metamag', 'Disponibilidad para resolver bloqueos y aprobar cambios fuera del marco acordado.', 'Configuración, monitoreo y ajustes dentro de alcance.', '30 días desde activación', 'Registro de gestión y reporte de métricas disponibles.'),
      service('Atención y atribución de ventas', 'client', 'Atención de leads, registro de ventas y fuentes.', 'Métricas de plataforma y reporte según acceso.', 'Durante y después de campaña', 'Fuente y límites reportados; no se garantizan ventas.'),
    ],
    estimate: [
      activity('discovery', 'Objetivo, medición y requisitos', 'media_specialist', 2, 3, 5, ['Una oferta y plataforma publicitaria.']),
      activity('setup', 'Configuración inicial y QA', 'media_specialist', 3, 5, 8, ['Cuenta y métodos de pago activos; inversión externa excluida.']),
      activity('creative', 'Adaptación a creatividades existentes', 'copywriter', 1, 2, 4, ['Piezas suministradas o contratadas aparte.']),
      activity('monitoring', 'Monitoreo y ajustes durante 30 días', 'media_specialist', 6, 9, 15, ['Frecuencia y cambios sujetos a volumen y plataforma.']),
      activity('reporting', 'Análisis y reporte', 'strategist', 2, 3, 5, ['Métricas disponibles en plataforma e integraciones.']),
      activity('qa', 'Revisión de medición y calidad', 'qa_specialist', 1, 1.5, 3, ['No reemplaza auditoría independiente de plataforma.']),
      activity('management', 'Reuniones y coordinación', 'project_manager', 1.5, 2.5, 4, ['Reunión inicial y cierre; coordinación asíncrona.']),
    ],
    dependencies: ['Cuenta y permisos', 'Presupuesto de pauta separado', 'Oferta, destino y creatividades aprobados'],
    risks: ['Revisión de anuncios, cambios de plataforma y respuesta del mercado no están bajo control de Metamag'],
    recurring: true,
    discountEligible: false,
  }),
];

export function getCommercialService(id: CommercialServiceId): CommercialService | undefined {
  return COMMERCIAL_SERVICES.find((service) => service.id === id);
}
