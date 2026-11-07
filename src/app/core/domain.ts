import type { GrowthEvaluation } from './growth-model';

export type QuestionStatus = 'pending' | 'answered' | 'unknown' | 'requires_verification' | 'not_applicable';
export type InterviewMode = 'essential' | 'complete';
export type EvidenceLevel = 'unverified' | 'specific_report' | 'observable' | 'documented';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type RecommendationStatus =
  | 'recommended_now'
  | 'recommended_conditionally'
  | 'recommended_next_stage'
  | 'not_priority'
  | 'requires_validation';
export type EvaluationState = 'not_assessed' | 'no_capacity' | 'demonstrated' | 'insufficient';

export interface QuestionCondition {
  questionId: string;
  field: 'answer' | 'choice' | 'status' | 'evidenceLevel';
  operator: 'equals' | 'not_equals' | 'contains' | 'answered' | 'status_is';
  value?: string;
}

export interface GuidedQuestion {
  id: string;
  text: string;
  purpose?: string;
  exampleAnswer?: string;
  dimensionIds: string[];
  followUps: string[];
  advisorTip: string;
  riskSignal: string;
  expectedEvidence: string[];
  inputType?: 'select';
  options?: string[];
  condition?: QuestionCondition;
}

export interface FormSection {
  id: string;
  title: string;
  durationMinutes: number;
  purpose: string;
  openingScript?: string;
  questions: GuidedQuestion[];
}

export interface MaturityLevel {
  id: number;
  name: string;
  minScore: number;
  maxScore: number;
  focus: string;
  potentialServices: string[];
  progressionRequirements: string[];
}

export interface FormDefinition {
  schemaVersion: string;
  formId: string;
  title: string;
  description: string;
  estimatedDurationMinutes: number;
  client: {
    name: string;
    project: string;
    productType: string;
    launchDate: string;
    reportedInitialSales: number | null;
    salesOriginVerified: boolean;
    objectivesReported: string[];
    notes: string;
  };
  responseModel: {
    evidenceLevels: { id: EvidenceLevel; label: string }[];
  };
  dimensions: { id: string; name: string }[];
  sections: FormSection[];
  maturityModel: {
    id: string;
    maximumScore: number;
    requireAllDimensionsForDefinitiveLevel: boolean;
    levels: MaturityLevel[];
    assessmentRules: string[];
  };
  reportConfiguration: {
    clientPdf: { title: string; excludeFields: string[] };
    internalReport: { includePrivateNotes: boolean };
  };
}

export interface QuestionResponse {
  answer: string;
  choice: string;
  evidence: string;
  evidenceLevel: EvidenceLevel | '';
  status: QuestionStatus;
  advisorPrivateNotes: string;
  followUpRequired: boolean;
}

export interface DimensionAssessment {
  score: number | null;
  justification: string;
  evidence: string;
  confidence: ConfidenceLevel | '';
  state: EvaluationState;
  criticalGap: boolean;
}

export interface ServiceDefinition {
  id: string;
  name: string;
  description: string;
  problem: string;
  evidence: string[];
  prerequisites: string[];
  deliverables: string[];
  complexity: 'baja' | 'media' | 'alta';
  dependencies: string[];
  duration: string;
  dimensionIds: string[];
}

export interface ServiceRecommendation {
  serviceId: string;
  status: RecommendationStatus;
  justification: string;
  selected: boolean;
  advisorEdited: boolean;
}

export interface RoadmapAction {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  expectedEvidence: string;
  status: 'pending' | 'in_progress' | 'done';
  priority: 'high' | 'medium' | 'low';
  horizon: 7 | 30 | 60 | 90;
}

export interface ExecutiveSummary {
  confirmedFacts: string;
  declaredFacts: string;
  inferences: string;
  strengths: string;
  difficulties: string;
  pendingInformation: string;
  risksAndDependencies: string;
  authorResponsibilities: string;
  metamagResponsibilities: string;
  priorities: string;
  advisorDecisions: string;
  nextActions: string;
  dates: string;
}

export interface DiscoverySession {
  id: string;
  formId: string;
  formSnapshot?: FormDefinition;
  createdAt: string;
  updatedAt: string;
  clientName: string;
  organization: string;
  project: string;
  advisor: string;
  meetingDate: string;
  objective: string;
  productType: string;
  knownState: string;
  initialNotes: string;
  activeSectionId: string;
  activeQuestionId: string;
  interviewMode?: InterviewMode;
  responses: Record<string, QuestionResponse>;
  assessments: Record<string, DimensionAssessment>;
  manualLevelId: number | null;
  manualLevelJustification: string;
  recommendations: Partial<Record<string, ServiceRecommendation>>;
  actions: RoadmapAction[];
  initiativeComplexity: 'low' | 'medium' | 'high' | '';
  internalCapacity: string;
  delegatedResponsibilities: string;
  budgetAndTimeline: string;
  executiveSummary?: ExecutiveSummary;
  executiveSummaryApproved?: boolean;
  growthEvaluation?: GrowthEvaluation;
  growthClassificationApproved?: boolean;
  growthReviewNote?: string;
}

export interface AssessmentResult {
  assessedDimensions: number;
  totalDimensions: number;
  score: number;
  definitive: boolean;
  level: MaturityLevel | null;
  provisionalRange: { minimum: MaturityLevel; maximum: MaturityLevel } | null;
  confidence: ConfidenceLevel | 'insufficient';
  criticalConstraint: string | null;
  strengths: { dimensionId: string; evidence: string }[];
  gaps: { dimensionId: string; score: number; justification: string; critical: boolean }[];
}

export function emptyResponse(): QuestionResponse {
  return {
    answer: '',
    choice: '',
    evidence: '',
    evidenceLevel: '',
    status: 'pending',
    advisorPrivateNotes: '',
    followUpRequired: false,
  };
}

export function emptyAssessment(): DimensionAssessment {
  return {
    score: null,
    justification: '',
    evidence: '',
    confidence: '',
    state: 'not_assessed',
    criticalGap: false,
  };
}

export function createSession(form: FormDefinition, advisor = ''): DiscoverySession {
  const firstSection = form.sections[0];
  const firstQuestion = firstSection?.questions[0];
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    formId: form.formId,
    formSnapshot: form,
    createdAt: now,
    updatedAt: now,
    clientName: form.client.name,
    organization: '',
    project: form.client.project,
    advisor,
    meetingDate: new Date().toISOString().slice(0, 10),
    objective: form.client.objectivesReported.join('; '),
    productType: form.client.productType,
    knownState: `Fecha de lanzamiento reportada: ${form.client.launchDate || 'sin confirmar'}; ${
      form.client.reportedInitialSales === null
        ? 'ventas iniciales no reportadas'
        : `${form.client.reportedInitialSales} ventas iniciales reportadas`
    }; origen de compradores ${form.client.salesOriginVerified ? 'verificado' : 'no confirmado'}.`,
    initialNotes: form.client.notes,
    activeSectionId: firstSection?.id ?? '',
    activeQuestionId: firstQuestion?.id ?? '',
    interviewMode: 'essential',
    responses: {},
    assessments: Object.fromEntries(form.dimensions.map(({ id }) => [id, emptyAssessment()])),
    manualLevelId: null,
    manualLevelJustification: '',
    recommendations: {},
    actions: [],
    initiativeComplexity: '',
    internalCapacity: '',
    delegatedResponsibilities: '',
    budgetAndTimeline: '',
    executiveSummary: emptyExecutiveSummary(),
    executiveSummaryApproved: false,
  };
}

export function emptyExecutiveSummary(): ExecutiveSummary {
  return {
    confirmedFacts: '',
    declaredFacts: '',
    inferences: '',
    strengths: '',
    difficulties: '',
    pendingInformation: '',
    risksAndDependencies: '',
    authorResponsibilities: '',
    metamagResponsibilities: '',
    priorities: '',
    advisorDecisions: '',
    nextActions: '',
    dates: '',
  };
}
