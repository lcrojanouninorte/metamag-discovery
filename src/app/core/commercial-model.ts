export const COMMERCIAL_CATALOG_VERSION = '1.2.0';

export type CommercialServiceId =
  | 'commercial-diagnosis'
  | 'content-strategy'
  | 'social-design'
  | 'short-video-editing'
  | 'landing-page'
  | 'crm-setup'
  | 'masterclass-support'
  | 'ad-campaign-management';

export type CommercialLevelId = 'exploracion' | 'activacion' | 'traccion' | 'optimizacion' | 'escalamiento';
export type CommercialRoleId =
  | 'strategist'
  | 'project_manager'
  | 'consultant'
  | 'copywriter'
  | 'designer'
  | 'video_editor'
  | 'web_developer'
  | 'automation_specialist'
  | 'event_producer'
  | 'media_specialist'
  | 'qa_specialist';
export type CommercialUncertainty = 'low' | 'medium' | 'high';
export type ProposalOptionId = 'essential' | 'recommended' | 'comprehensive';
export type ProposalStatus =
  | 'draft'
  | 'estimation_incomplete'
  | 'pending_review'
  | 'internally_approved'
  | 'shared_with_client'
  | 'accepted'
  | 'rejected';

export interface HourRange {
  min: number | null;
  expected: number | null;
  max: number | null;
}

export interface ServiceActivity {
  id: string;
  name: string;
  profileId: CommercialRoleId;
  hours: HourRange;
  assumptions: string[];
  uncertainty: CommercialUncertainty;
  sharedActivityKey?: string;
  sharedActivityJustification?: string;
}

export interface ServiceDeliverable {
  id: string;
  name: string;
  quantity: number;
  format: string;
  acceptanceCriteria: string;
}

export interface Responsibility {
  activity: string;
  lead: 'client' | 'metamag' | 'shared';
  clientContribution: string;
  metamagContribution: string;
  dependency: string;
  acceptanceCriteria: string;
  state: 'included' | 'optional' | 'excluded' | 'pending';
}

export interface ServiceMetric {
  id: string;
  name: string;
  kind: 'execution' | 'quality' | 'commercial';
  formula: string;
  source: string;
  baseline: 'available' | 'pending';
  frequency: string;
  owner: string;
  control: 'metamag' | 'shared' | 'external';
  limitation: string;
}

export interface CommercialService {
  id: CommercialServiceId;
  name: string;
  description: string;
  category: string;
  relatedLevels: CommercialLevelId[];
  problem: string;
  evidenceBasis: string[];
  objective: string;
  activities: string[];
  deliverables: ServiceDeliverable[];
  revisionsIncluded: number;
  calendarDuration: { minDays: number; expectedDays: number; maxDays: number };
  exclusions: string[];
  clientResponsibilities: string[];
  metamagResponsibilities: string[];
  responsibilities: Responsibility[];
  activitiesEstimate: ServiceActivity[];
  dependencies: string[];
  risks: string[];
  metrics: ServiceMetric[];
  recurring: boolean;
  discountEligible: boolean;
  defaultQuantity: number;
}

export interface CommercialProfile {
  id: CommercialRoleId;
  name: string;
  hourlyCostCOP: number | null;
  commercialHourlyRateCOP: number | null;
}

export interface CommercialSettings {
  profiles: CommercialProfile[];
  indirectCostPercent: number;
  indirectCostConfigured: boolean;
  contingencyPercent: number;
  targetMarginPercent: number;
  minimumAuthorizedMarginPercent: number;
  defaultDiscountPercent: number;
  maximumDiscountPercent: number;
  quoteValidityDays: number;
  suggestedPaymentTerms: string;
  taxPercent: number | null;
  taxValidationStatus: 'pending' | 'validated';
  taxTreatments: Record<CommercialServiceId, TaxTreatment>;
  withholdingPercent: number | null;
  currency: 'COP';
}

export type TaxTreatment = 'taxable' | 'excluded' | 'pending';

export interface CommercialServicePricing {
  unit: string;
  referencePriceCOP: number;
  estimatedDirectCostCOP: number;
  status: 'estimated';
  lastModified: string;
  includedScope: string;
  exclusions: string[];
  hoursByProfile: Partial<Record<CommercialRoleId, number>>;
}

export interface CommercialServiceLine {
  id: string;
  serviceId: CommercialServiceId;
  serviceSnapshot?: CommercialService;
  quantity: number;
  priceReviewed: boolean;
  objective: string;
  scopeNotes: string;
  calendarDuration: { minDays: number | null; expectedDays: number | null; maxDays: number | null };
  deliverables: ServiceDeliverable[];
  exclusions: string[];
  activitiesEstimate: ServiceActivity[];
  thirdPartyCostCOP: number | null;
  otherDirectCostCOP: number | null;
  thirdPartyChargeCOP: number | null;
  proposedUnitPriceCOP: number | null;
  actualHoursByProfile: Partial<Record<CommercialRoleId, number>>;
  taxTreatment: TaxTreatment;
  discountEligible: boolean;
  dependencyNote: string;
}

export interface CommercialAlternative {
  id: ProposalOptionId;
  name: string;
  positioning: string;
  lines: CommercialServiceLine[];
  discountPercent: number;
  paymentTerms: string;
  scheduleNote: string;
  externalCostNote: string;
}

export interface ProposalRevision {
  id: string;
  savedAt: string;
  catalogVersion: string;
  status: ProposalStatus;
  selectedAlternativeId: ProposalOptionId;
  validUntil: string;
  settings: CommercialSettings;
  servicePricing: Record<CommercialServiceId, CommercialServicePricing>;
  alternatives: CommercialAlternative[];
  advisorNote: string;
  taxNote: string;
  discountApproval: { approved: boolean; justification: string; responsible: string; declaredAt: string };
  internalApproval: { approved: boolean; note: string; approvedAt: string };
  clientStatusNote: string;
}

export interface CommercialProposal {
  id: string;
  catalogVersion: string;
  createdAt: string;
  updatedAt: string;
  validUntil: string;
  status: ProposalStatus;
  selectedAlternativeId: ProposalOptionId;
  settings: CommercialSettings;
  alternatives: CommercialAlternative[];
  advisorNote: string;
  taxNote: string;
  discountApproval: { approved: boolean; justification: string; responsible: string; declaredAt: string };
  internalApproval: { approved: boolean; note: string; approvedAt: string };
  clientStatusNote: string;
  revisions: ProposalRevision[];
  servicePricing: Record<CommercialServiceId, CommercialServicePricing>;
}

export const COMMERCIAL_PROFILES: Omit<CommercialProfile, 'hourlyCostCOP' | 'commercialHourlyRateCOP'>[] = [
  { id: 'strategist', name: 'Estrategia comercial' },
  { id: 'project_manager', name: 'Gestión de proyecto' },
  { id: 'consultant', name: 'Consultoría comercial' },
  { id: 'copywriter', name: 'Copywriting y contenidos' },
  { id: 'designer', name: 'Diseño gráfico' },
  { id: 'video_editor', name: 'Edición audiovisual' },
  { id: 'web_developer', name: 'Desarrollo web' },
  { id: 'automation_specialist', name: 'Automatización y CRM' },
  { id: 'event_producer', name: 'Producción de eventos' },
  { id: 'media_specialist', name: 'Gestión de pauta' },
  { id: 'qa_specialist', name: 'Calidad y documentación' },
];

export const COMMERCIAL_PROFILE_COST_DEFAULTS: Partial<Record<CommercialRoleId, number>> = {
  strategist: 45_000,
  project_manager: 35_000,
  consultant: 35_000,
  designer: 28_000,
  video_editor: 30_000,
  web_developer: 45_000,
  media_specialist: 35_000,
  event_producer: 35_000,
};

export const COMMERCIAL_SERVICE_UNITS: Record<CommercialServiceId, string> = {
  'commercial-diagnosis': 'Proyecto',
  'content-strategy': 'Mes',
  'social-design': 'Paquete',
  'short-video-editing': 'Paquete',
  'landing-page': 'Proyecto',
  'crm-setup': 'Proyecto',
  'masterclass-support': 'Evento',
  'ad-campaign-management': 'Mes',
};

const servicePricingDefaults: Record<CommercialServiceId, Omit<CommercialServicePricing, 'lastModified'>> = {
  'commercial-diagnosis': {
    unit: 'Proyecto', referencePriceCOP: 500_000, estimatedDirectCostCOP: 0, status: 'estimated',
    includedScope: 'Diagnóstico consultivo y plan comercial de 30 días.',
    exclusions: ['Implementación de acciones', 'Investigación de mercado estadística'],
    hoursByProfile: { consultant: 5, strategist: 2 },
  },
  'content-strategy': {
    unit: 'Mes', referencePriceCOP: 750_000, estimatedDirectCostCOP: 0, status: 'estimated',
    includedScope: 'Estrategia de contenidos y calendario editorial mensual.',
    exclusions: ['Diseño o producción de piezas', 'Publicación y respuesta a mensajes'],
    hoursByProfile: { strategist: 6, consultant: 8 },
  },
  'social-design': {
    unit: 'Paquete', referencePriceCOP: 800_000, estimatedDirectCostCOP: 0, status: 'estimated',
    includedScope: 'Diseño de ocho piezas para redes sociales.',
    exclusions: ['Fotografía o ilustración original compleja', 'Publicación o moderación'],
    hoursByProfile: { designer: 20, project_manager: 2 },
  },
  'short-video-editing': {
    unit: 'Paquete', referencePriceCOP: 700_000, estimatedDirectCostCOP: 0, status: 'estimated',
    includedScope: 'Edición de cuatro videos cortos con material suministrado.',
    exclusions: ['Grabación presencial', 'Compra de recursos o licencias'],
    hoursByProfile: { video_editor: 16, project_manager: 2 },
  },
  'landing-page': {
    unit: 'Proyecto', referencePriceCOP: 1_800_000, estimatedDirectCostCOP: 0, status: 'estimated',
    includedScope: 'Landing page básica con diseño, implementación y pruebas.',
    exclusions: ['Dominio, hosting, suscripciones e integraciones no especificadas'],
    hoursByProfile: { web_developer: 24, designer: 5, project_manager: 3 },
  },
  'crm-setup': {
    unit: 'Proyecto', referencePriceCOP: 850_000, estimatedDirectCostCOP: 0, status: 'estimated',
    includedScope: 'Configuración básica de CRM.',
    exclusions: ['Licencias', 'Migración masiva de datos', 'Integraciones complejas'],
    hoursByProfile: { web_developer: 12, consultant: 5 },
  },
  'masterclass-support': {
    unit: 'Evento', referencePriceCOP: 1_100_000, estimatedDirectCostCOP: 0, status: 'estimated',
    includedScope: 'Acompañamiento básico: configuración, asesoría, ensayo limitado y soporte acordado.',
    exclusions: ['Producción integral', 'Landing, pauta, edición posterior y seguimiento comercial no seleccionados'],
    hoursByProfile: { event_producer: 10, consultant: 5, designer: 3 },
  },
  'ad-campaign-management': {
    unit: 'Mes', referencePriceCOP: 950_000, estimatedDirectCostCOP: 0, status: 'estimated',
    includedScope: 'Gestión de una campaña publicitaria durante 30 días.',
    exclusions: ['Presupuesto de pauta y cargos de plataforma', 'Producción de piezas no contratadas'],
    hoursByProfile: { media_specialist: 12, strategist: 4, project_manager: 3 },
  },
};

export function createCommercialServicePricing(now = new Date()): Record<CommercialServiceId, CommercialServicePricing> {
  return Object.fromEntries(
    Object.entries(servicePricingDefaults).map(([id, pricing]) => [
      id,
      { ...structuredClone(pricing), lastModified: now.toISOString() },
    ]),
  ) as Record<CommercialServiceId, CommercialServicePricing>;
}

export function createCommercialSettings(current?: Partial<CommercialSettings>): CommercialSettings {
  const taxTreatments = {} as CommercialSettings['taxTreatments'];
  for (const id of Object.keys(servicePricingDefaults) as CommercialServiceId[]) {
    taxTreatments[id] = current?.taxTreatments?.[id] ?? 'pending';
  }
  return {
    profiles: COMMERCIAL_PROFILES.map((profile) => {
      const saved = current?.profiles?.find((item) => item.id === profile.id);
      return {
        ...profile,
        hourlyCostCOP: saved ? saved.hourlyCostCOP : COMMERCIAL_PROFILE_COST_DEFAULTS[profile.id] ?? null,
        commercialHourlyRateCOP: saved?.commercialHourlyRateCOP ?? null,
      };
    }),
    indirectCostPercent: current?.indirectCostPercent ?? 0,
    indirectCostConfigured: current?.indirectCostConfigured ?? false,
    contingencyPercent: current?.contingencyPercent ?? 10,
    targetMarginPercent: current?.targetMarginPercent ?? 40,
    minimumAuthorizedMarginPercent: current?.minimumAuthorizedMarginPercent ?? 25,
    defaultDiscountPercent: current?.defaultDiscountPercent ?? 0,
    maximumDiscountPercent: current?.maximumDiscountPercent ?? 15,
    quoteValidityDays: current?.quoteValidityDays ?? 15,
    suggestedPaymentTerms: current?.suggestedPaymentTerms ?? '50 % al inicio y 50 % contra el hito acordado.',
    taxPercent: current?.taxPercent ?? null,
    taxValidationStatus: current?.taxValidationStatus ?? 'pending',
    taxTreatments,
    withholdingPercent: current?.withholdingPercent ?? null,
    currency: 'COP',
  };
}

export function createCommercialProposal(now = new Date()): CommercialProposal {
  const settings = createCommercialSettings();
  const validUntil = new Date(now);
  validUntil.setDate(validUntil.getDate() + settings.quoteValidityDays);
  return {
    id: crypto.randomUUID(),
    catalogVersion: COMMERCIAL_CATALOG_VERSION,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    validUntil: validUntil.toISOString().slice(0, 10),
    status: 'draft',
    selectedAlternativeId: 'recommended',
    settings,
    servicePricing: createCommercialServicePricing(now),
    alternatives: [
      {
        id: 'essential',
        name: 'Esencial',
        positioning: 'Resolver las brechas prioritarias con alcance acotado y evidencias concretas.',
        lines: [],
        discountPercent: settings.defaultDiscountPercent,
        paymentTerms: settings.suggestedPaymentTerms,
        scheduleNote: '',
        externalCostNote: '',
      },
      {
        id: 'recommended',
        name: 'Recomendada',
        positioning: 'Acompañamiento equilibrado, definido a partir de prioridades verificables.',
        lines: [],
        discountPercent: settings.defaultDiscountPercent,
        paymentTerms: settings.suggestedPaymentTerms,
        scheduleNote: '',
        externalCostNote: '',
      },
      {
        id: 'comprehensive',
        name: 'Integral',
        positioning: 'Mayor cobertura únicamente cuando el diagnóstico y la capacidad del cliente la justifiquen.',
        lines: [],
        discountPercent: settings.defaultDiscountPercent,
        paymentTerms: settings.suggestedPaymentTerms,
        scheduleNote: '',
        externalCostNote: '',
      },
    ],
    advisorNote: '',
    taxNote: '',
    discountApproval: { approved: false, justification: '', responsible: '', declaredAt: '' },
    internalApproval: { approved: false, note: '', approvedAt: '' },
    clientStatusNote: '',
    revisions: [],
  };
}

export function createProposalRevision(proposal: CommercialProposal, now = new Date()): ProposalRevision {
  return {
    id: crypto.randomUUID(),
    savedAt: now.toISOString(),
    catalogVersion: proposal.catalogVersion,
    status: proposal.status,
    selectedAlternativeId: proposal.selectedAlternativeId,
    validUntil: proposal.validUntil,
    settings: structuredClone(proposal.settings),
    servicePricing: structuredClone(proposal.servicePricing),
    alternatives: structuredClone(proposal.alternatives),
    advisorNote: proposal.advisorNote,
    taxNote: proposal.taxNote,
    discountApproval: structuredClone(proposal.discountApproval),
    internalApproval: structuredClone(proposal.internalApproval),
    clientStatusNote: proposal.clientStatusNote,
  };
}

export function migrateCommercialProposal(proposal: CommercialProposal, now = new Date()): CommercialProposal {
  const legacy = proposal as CommercialProposal & {
    settings: Partial<CommercialSettings>;
    servicePricing?: Partial<Record<CommercialServiceId, CommercialServicePricing>>;
  };
  const settings = createCommercialSettings(legacy.settings);
  const defaults = createCommercialServicePricing(now);
  const servicePricing = { ...defaults, ...legacy.servicePricing };
  const previousCatalog = proposal.catalogVersion !== COMMERCIAL_CATALOG_VERSION;
  if (previousCatalog) {
    settings.profiles = settings.profiles.map((profile) => {
      const saved = legacy.settings.profiles?.find((item) => item.id === profile.id);
      return saved?.hourlyCostCOP === null || saved?.hourlyCostCOP === undefined
        ? { ...profile, hourlyCostCOP: COMMERCIAL_PROFILE_COST_DEFAULTS[profile.id] ?? null }
        : profile;
    });
  }
  const approval = legacy.discountApproval ?? {
    approved: false, justification: '', responsible: '', declaredAt: '',
  };
  return {
    ...proposal,
    catalogVersion: COMMERCIAL_CATALOG_VERSION,
    settings,
    servicePricing,
    discountApproval: {
      approved: approval.approved ?? false,
      justification: approval.justification ?? '',
      responsible: approval.responsible ?? '',
      declaredAt: approval.declaredAt ?? '',
    },
    alternatives: proposal.alternatives.map((alternative) => ({
      ...alternative,
      discountPercent: previousCatalog ? settings.defaultDiscountPercent : alternative.discountPercent,
      paymentTerms: alternative.paymentTerms || settings.suggestedPaymentTerms,
      lines: alternative.lines.map((line) => ({
        ...line,
        proposedUnitPriceCOP: line.proposedUnitPriceCOP ?? servicePricing[line.serviceId]?.referencePriceCOP ?? null,
        actualHoursByProfile: line.actualHoursByProfile ?? {},
        taxTreatment: line.taxTreatment ?? settings.taxTreatments[line.serviceId] ?? 'pending',
      })),
    })),
    revisions: (proposal.revisions ?? []).map((revision) => ({
      ...revision,
      servicePricing: revision.servicePricing ?? structuredClone(servicePricing),
    })),
  };
}

export function proposalStatusLabel(status: ProposalStatus): string {
  return status === 'draft' ? 'Borrador'
    : status === 'estimation_incomplete' ? 'Estimación incompleta'
      : status === 'pending_review' ? 'Pendiente de revisión'
        : status === 'internally_approved' ? 'Aprobada internamente'
          : status === 'shared_with_client' ? 'Compartida con cliente'
            : status === 'accepted' ? 'Aceptada' : 'Rechazada';
}
