export const COMMERCIAL_CATALOG_VERSION = '1.1.0';

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
}

export interface CommercialSettings {
  profiles: CommercialProfile[];
  indirectCostPercent: number | null;
  contingencyPercent: number | null;
  targetMarginPercent: number | null;
  minimumAuthorizedMarginPercent: number | null;
  taxPercent: number | null;
  currency: 'COP';
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
  discountEligible: boolean;
  dependencyNote: string;
}

export interface CommercialAlternative {
  id: ProposalOptionId;
  name: string;
  positioning: string;
  lines: CommercialServiceLine[];
  discountPercent: 0 | 10 | 15 | 20;
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
  alternatives: CommercialAlternative[];
  advisorNote: string;
  taxNote: string;
  discountApproval: { approved: boolean; justification: string };
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
  discountApproval: { approved: boolean; justification: string };
  internalApproval: { approved: boolean; note: string; approvedAt: string };
  clientStatusNote: string;
  revisions: ProposalRevision[];
}

export const COMMERCIAL_PROFILES: Omit<CommercialProfile, 'hourlyCostCOP'>[] = [
  { id: 'strategist', name: 'Estrategia comercial' },
  { id: 'project_manager', name: 'Gestión de proyecto' },
  { id: 'copywriter', name: 'Copywriting y contenidos' },
  { id: 'designer', name: 'Diseño gráfico' },
  { id: 'video_editor', name: 'Edición audiovisual' },
  { id: 'web_developer', name: 'Desarrollo web' },
  { id: 'automation_specialist', name: 'Automatización y CRM' },
  { id: 'event_producer', name: 'Producción de eventos' },
  { id: 'media_specialist', name: 'Gestión de pauta' },
  { id: 'qa_specialist', name: 'Calidad y documentación' },
];

export function createCommercialSettings(): CommercialSettings {
  return {
    profiles: COMMERCIAL_PROFILES.map((profile) => ({ ...profile, hourlyCostCOP: null })),
    indirectCostPercent: null,
    contingencyPercent: null,
    targetMarginPercent: null,
    minimumAuthorizedMarginPercent: null,
    taxPercent: null,
    currency: 'COP',
  };
}

export function createCommercialProposal(now = new Date()): CommercialProposal {
  const validUntil = new Date(now);
  validUntil.setDate(validUntil.getDate() + 15);
  return {
    id: crypto.randomUUID(),
    catalogVersion: COMMERCIAL_CATALOG_VERSION,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    validUntil: validUntil.toISOString().slice(0, 10),
    status: 'draft',
    selectedAlternativeId: 'recommended',
    settings: createCommercialSettings(),
    alternatives: [
      {
        id: 'essential',
        name: 'Esencial',
        positioning: 'Resolver las brechas prioritarias con alcance acotado y evidencias concretas.',
        lines: [],
        discountPercent: 15,
        paymentTerms: '',
        scheduleNote: '',
        externalCostNote: '',
      },
      {
        id: 'recommended',
        name: 'Recomendada',
        positioning: 'Acompañamiento equilibrado, definido a partir de prioridades verificables.',
        lines: [],
        discountPercent: 15,
        paymentTerms: '',
        scheduleNote: '',
        externalCostNote: '',
      },
      {
        id: 'comprehensive',
        name: 'Integral',
        positioning: 'Mayor cobertura únicamente cuando el diagnóstico y la capacidad del cliente la justifiquen.',
        lines: [],
        discountPercent: 15,
        paymentTerms: '',
        scheduleNote: '',
        externalCostNote: '',
      },
    ],
    advisorNote: '',
    taxNote: '',
    discountApproval: { approved: false, justification: '' },
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
    alternatives: structuredClone(proposal.alternatives),
    advisorNote: proposal.advisorNote,
    taxNote: proposal.taxNote,
    discountApproval: structuredClone(proposal.discountApproval),
    internalApproval: structuredClone(proposal.internalApproval),
    clientStatusNote: proposal.clientStatusNote,
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
