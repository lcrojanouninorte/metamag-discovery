import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  DiscoverySession,
  DimensionAssessment,
  ExecutiveSummary,
  EvidenceLevel,
  EvaluationState,
  emptyExecutiveSummary,
  emptyAssessment,
  emptyResponse,
  FormDefinition,
  InterviewMode,
  QuestionStatus,
  QuestionResponse,
  RecommendationStatus,
  RoadmapAction,
} from '../core/domain';
import {
  classifyGrowth,
  createGrowthEvaluation,
  GROWTH_CRITERIA,
  GROWTH_DIMENSIONS,
  GROWTH_LEVELS,
  invalidateGrowthEvidenceForQuestions,
  growthRequirementState,
  GrowthCriterion,
  GrowthCriterionEvaluation,
  GrowthDimensionId,
  GrowthEvaluation,
  GrowthLevelId,
  suggestGrowthPotential,
} from '../core/growth-model';
import { assessMaturity, validateManualLevel } from '../core/assessment';
import { FormDefinitionService } from '../core/form-definition.service';
import {
  dimensionCoverage,
  hasCapturedResponse,
  interviewCoverage,
  questionResponseState,
  questionsForInterview,
} from '../core/interview-progress';
import { createClientReport } from '../core/report';
import { recommendServices, SERVICE_CATALOG, serviceById } from '../core/services.catalog';
import { SessionStore } from '../core/session-store';
import {
  COMMERCIAL_CATALOG_VERSION,
  CommercialAlternative,
  CommercialProposal,
  CommercialService,
  CommercialServiceLine,
  CommercialServicePricing,
  CommercialRoleId,
  CommercialServiceId,
  ProposalOptionId,
  ProposalRevision,
  ProposalStatus,
  ServiceActivity,
  TaxTreatment,
  COMMERCIAL_PROFILES,
  createCommercialProposal,
  createProposalRevision,
  migrateCommercialProposal,
  proposalStatusLabel,
} from '../core/commercial-model';
import { COMMERCIAL_SERVICES, getCommercialService } from '../core/commercial-catalog';
import { exportCommercialConfiguration as serializeCommercialConfiguration, parseCommercialConfiguration } from '../core/commercial-config';
import { calculateAlternative, EstimateScenario, HourSummary } from '../core/commercial-calculator';
import { createClientProposalDocument } from '../core/commercial-report';

type SessionView = 'interview' | 'summary' | 'diagnosis' | 'client-report' | 'internal-report' | 'proposal' | 'combined-report';

@Component({
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './session.component.html',
})
export class SessionComponent {
  readonly store = inject(SessionStore);
  readonly forms = inject(FormDefinitionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly sessionId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly view = signal<SessionView>('interview');
  readonly selectedGrowthLevel = signal<GrowthLevelId>('exploracion');
  readonly formDefinition = computed(() => this.session()?.formSnapshot ?? this.forms.form());
  readonly session = computed(() => this.store.sessions().find((item) => item.id === this.sessionId) ?? null);
  readonly commercialCatalog = COMMERCIAL_SERVICES;
  readonly commercialProfiles = COMMERCIAL_PROFILES;
  readonly commercialCatalogVersion = COMMERCIAL_CATALOG_VERSION;
  readonly estimateScenarios = ['optimistic', 'base', 'conservative'] as const;
  readonly commercialProposal = computed(() => {
    const proposal = this.session()?.commercialProposal;
    return proposal ? migrateCommercialProposal(proposal) : null;
  });
  readonly proposalApprovedForSharing = computed(() => {
    const proposal = this.commercialProposal();
    return !!proposal?.internalApproval.approved &&
      ['internally_approved', 'shared_with_client', 'accepted', 'rejected'].includes(proposal.status);
  });
  readonly activeAlternative = computed(() => {
    const proposal = this.commercialProposal();
    return proposal?.alternatives.find((item) => item.id === proposal.selectedAlternativeId) ?? null;
  });
  readonly commercialCalculation = computed(() => {
    const proposal = this.commercialProposal();
    const alternative = this.activeAlternative();
    return proposal && alternative ? calculateAlternative(proposal, alternative) : null;
  });
  readonly clientProposalDocument = computed(() => {
    const session = this.session();
    const proposal = this.commercialProposal();
    const alternative = this.activeAlternative();
    const calculation = this.commercialCalculation();
    return session && proposal && alternative && calculation
      ? createClientProposalDocument(session, proposal, alternative, calculation)
      : null;
  });
  readonly interviewQuestions = computed(() => {
    const form = this.formDefinition();
    const session = this.session();
    return form && session ? questionsForInterview(form, session) : [];
  });
  readonly activeSection = computed(() =>
    this.formDefinition()?.sections.find((section) => section.id === this.session()?.activeSectionId) ?? null,
  );
  readonly visibleQuestions = computed(() => {
    const section = this.activeSection();
    return section ? this.interviewQuestions().filter((question) => question.id && section.questions.some((item) => item.id === question.id)) : [];
  });
  readonly currentQuestion = computed(() => {
    const session = this.session();
    const questions = this.visibleQuestions();
    return questions.find((question) => question.id === session?.activeQuestionId) ?? questions[0] ?? null;
  });
  readonly currentIndex = computed(() => this.visibleQuestions().findIndex((question) => question.id === this.currentQuestion()?.id));
  readonly coverage = computed(() => {
    const session = this.session();
    return session ? interviewCoverage(this.interviewQuestions(), session) : null;
  });
  readonly coverageByDimension = computed(() => {
    const form = this.formDefinition();
    const session = this.session();
    return form && session ? dimensionCoverage(form, this.interviewQuestions(), session) : [];
  });
  readonly pendingQuestions = computed(() => {
    const session = this.session();
    return session
      ? this.interviewQuestions().filter((question) => !hasCapturedResponse(session.responses[question.id]))
      : [];
  });
  readonly response = this.fb.group({
    answer: this.fb.control(''),
    choice: this.fb.control(''),
    evidence: this.fb.control(''),
    evidenceLevel: this.fb.control<EvidenceLevel | ''>(''),
    status: this.fb.control<QuestionStatus>('pending'),
    advisorPrivateNotes: this.fb.control(''),
    followUpRequired: this.fb.control(false),
  });
  readonly actionForm = this.fb.group({
    title: ['', Validators.required],
    owner: ['', Validators.required],
    dueDate: [''],
    expectedEvidence: ['', Validators.required],
    priority: ['medium' as RoadmapAction['priority']],
    horizon: [30 as RoadmapAction['horizon']],
  });
  readonly result = computed(() => {
    const form = this.formDefinition();
    const session = this.session();
    if (!form || !session) return null;
    const levelId = validateManualLevel(form, session.manualLevelId, session.manualLevelJustification)
      ? session.manualLevelId
      : null;
    return assessMaturity(form, session.assessments, levelId, session.manualLevelJustification);
  });
  readonly clientReport = computed(() => {
    const form = this.formDefinition();
    const session = this.session();
    return form && session ? createClientReport(form, session) : null;
  });
  readonly growthEvaluation = computed(() => this.session()?.growthEvaluation ?? createGrowthEvaluation());
  readonly growthClassification = computed(() => classifyGrowth(this.growthEvaluation()));
  readonly growthSuggestions = computed(() => suggestGrowthPotential(this.growthEvaluation()));
  readonly growthLevels = GROWTH_LEVELS;
  readonly growthDimensions = GROWTH_DIMENSIONS;
  readonly growthCriteria = computed(() =>
    GROWTH_CRITERIA.filter((criterion) => criterion.levelId === this.selectedGrowthLevel()),
  );
  readonly services = SERVICE_CATALOG;
  notice = '';

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const requested = params.get('view');
      this.view.set(requested === 'summary' || requested === 'diagnosis' || requested === 'client-report' || requested === 'internal-report' || requested === 'proposal' || requested === 'combined-report'
        ? requested
        : 'interview');
    });
    effect(() => {
      const question = this.currentQuestion();
      const session = this.session();
      if (!question || !session) return;
      this.response.patchValue(session.responses[question.id] ?? {
        answer: '',
        choice: '',
        evidence: '',
        evidenceLevel: '',
        status: 'pending',
        advisorPrivateNotes: '',
        followUpRequired: false,
      }, { emitEvent: false });
    });
    this.response.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => this.saveCurrentResponse(value));
  }

  sectionQuestionCount(sectionId: string): number {
    return this.interviewQuestions().filter((question) =>
      this.formDefinition()?.sections.find((section) => section.id === sectionId)?.questions.some((item) => item.id === question.id),
    ).length;
  }

  questionProgress(session: DiscoverySession, form: FormDefinition): string {
    const progress = interviewCoverage(questionsForInterview(form, session), session);
    return `${progress.answered} / ${progress.applicable}`;
  }

  questionProgressPercent(session: DiscoverySession, form: FormDefinition): number {
    return interviewCoverage(questionsForInterview(form, session), session).percentage;
  }

  sectionIndex(form: FormDefinition, id: string): string {
    return String(form.sections.findIndex((section) => section.id === id) + 1).padStart(2, '0');
  }

  totalQuestionCount(form: FormDefinition): number {
    return form.sections.reduce((sum, section) => sum + section.questions.length, 0);
  }

  statusText(value: string): string {
    return value === 'answered' ? 'Respondida'
      : value === 'unknown' ? 'No sabe'
        : value === 'requires_verification' ? 'Por verificar'
          : value === 'not_applicable' ? 'No aplica' : 'Pendiente';
  }

  evaluationStateLabel(state: EvaluationState): string {
    return state === 'no_capacity' ? 'Evaluada como inexistente'
      : state === 'demonstrated' ? 'Capacidad demostrada'
        : state === 'insufficient' ? 'Evidencia insuficiente' : 'No evaluada';
  }

  recommendationStatus(status: RecommendationStatus): string {
    return status === 'recommended_now' ? 'Recomendado ahora'
      : status === 'recommended_conditionally' ? 'Recomendado condicionado'
        : status === 'recommended_next_stage' ? 'Siguiente etapa'
          : status === 'not_priority' ? 'No prioritario' : 'Requiere validación';
  }

  exampleAnswer(question: { expectedEvidence: string[]; exampleAnswer?: string }): string {
    return question.exampleAnswer ??
      `Ejemplo de estructura, no de resultado: “El [fecha] realicé [acción]; ocurrió [resultado observable]. Puedo revisar: ${question.expectedEvidence[0] ?? 'la evidencia disponible'}.”`;
  }

  responseFor(session: DiscoverySession, questionId: string): QuestionResponse {
    return session.responses[questionId] ?? emptyResponse();
  }

  actionsFor(horizon: number): RoadmapAction[] {
    return this.session()?.actions.filter((action) => action.horizon === horizon) ?? [];
  }

  sectionAnsweredCount(sectionId: string): number {
    const session = this.session();
    if (!session) return 0;
    return this.interviewQuestions().filter((question) =>
      this.formDefinition()?.sections.find((section) => section.id === sectionId)?.questions.some((item) => item.id === question.id) &&
      hasCapturedResponse(session.responses[question.id]),
    ).length;
  }

  informationStateLabel(questionId: string): string {
    const state = questionResponseState(this.session()?.responses[questionId]);
    return state === 'confirmed' ? 'Confirmada'
      : state === 'declared' ? 'Declarada'
        : state === 'unknown' ? 'No sabe'
          : state === 'not_applicable' ? 'No aplica' : 'Pendiente';
  }

  setSection(sectionId: string): void {
    const form = this.formDefinition();
    const session = this.session();
    const section = form?.sections.find((item) => item.id === sectionId);
    if (!form || !session || !section) return;
    const first = this.interviewQuestions().find((question) => section.questions.some((item) => item.id === question.id));
    this.persist({ ...session, activeSectionId: sectionId, activeQuestionId: first?.id ?? '' });
  }

  setInterviewMode(mode: InterviewMode): void {
    const form = this.formDefinition();
    const session = this.session();
    if (!form || !session || session.interviewMode === mode) return;
    const questions = questionsForInterview(form, { ...session, interviewMode: mode });
    const currentQuestion = questions.find((question) => question.id === session.activeQuestionId);
    const firstQuestion = currentQuestion ?? questions[0];
    const activeSectionId = firstQuestion
      ? form.sections.find((section) => section.questions.some((question) => question.id === firstQuestion.id))?.id ?? session.activeSectionId
      : session.activeSectionId;
    this.persist({
      ...session,
      interviewMode: mode,
      activeSectionId,
      activeQuestionId: firstQuestion?.id ?? '',
    });
  }

  goToQuestion(questionId: string): void {
    const form = this.formDefinition();
    const session = this.session();
    const question = this.interviewQuestions().find((item) => item.id === questionId);
    if (!form || !session || !question) return;
    const sectionId = form.sections.find((section) => section.questions.some((item) => item.id === question.id))?.id;
    if (sectionId) this.persist({ ...session, activeSectionId: sectionId, activeQuestionId: question.id });
  }

  selectQuestion(questionId: string): void {
    const session = this.session();
    if (!session) return;
    this.persist({ ...session, activeQuestionId: questionId });
  }

  moveQuestion(direction: -1 | 1): void {
    const questions = this.visibleQuestions();
    const index = this.currentIndex() + direction;
    if (index >= 0 && index < questions.length) this.selectQuestion(questions[index].id);
  }

  getQuestionStatus(session: DiscoverySession, questionId: string): string {
    const status = session.responses[questionId]?.status ?? 'pending';
    return status === 'answered' ? 'Respondida'
      : status === 'unknown' ? 'No sabe'
        : status === 'requires_verification' ? 'Por verificar'
        : status === 'not_applicable' ? 'No aplica' : 'Pendiente';
  }

  setAssessmentScore(dimensionId: string, value: string): void {
    const score = value === '' ? null : Number(value);
    if (score !== null && (!Number.isInteger(score) || score < 0 || score > 3)) return;
    const existing = this.session()?.assessments[dimensionId];
    if (!existing) return;
    this.updateAssessment(dimensionId, {
      ...existing,
      score,
      state: evaluationState(score),
    });
  }

  selectGrowthLevel(levelId: GrowthLevelId): void {
    this.selectedGrowthLevel.set(levelId);
  }

  growthCriterionEvaluation(criterionId: string): GrowthCriterionEvaluation {
    return this.growthEvaluation().criteria[criterionId] ?? {
      criterionId,
      status: 'pending',
      result: '',
      evidence: '',
      justification: '',
      confidence: null,
    };
  }

  updateGrowthCriterion(
    criterionId: string,
    patch: Partial<GrowthCriterionEvaluation>,
  ): void {
    const session = this.session();
    if (!session) return;
    const evaluation = session.growthEvaluation ?? createGrowthEvaluation();
    const current = evaluation.criteria[criterionId] ?? this.growthCriterionEvaluation(criterionId);
    const updated: GrowthEvaluation = {
      ...evaluation,
      criteria: {
        ...evaluation.criteria,
        [criterionId]: {
          ...current,
          ...patch,
          criterionId,
          ...(Object.keys(patch).some((key) => ['result', 'evidence', 'justification'].includes(key))
            ? { sourceInvalidated: false }
            : {}),
        },
      },
    };
    this.persist({
      ...session,
      growthEvaluation: updated,
      growthClassificationApproved: false,
    });
  }

  growthQuestionsForDimension(dimensionId: GrowthDimensionId) {
    return this.interviewQuestions().filter((question) => question.dimensionIds.includes(dimensionId));
  }

  linkGrowthEvidence(criterion: GrowthCriterion, questionId: string): void {
    const response = this.session()?.responses[questionId];
    if (!response) return;
    const detail = [response.choice, response.answer, response.evidence].filter(Boolean).join(' — ').trim();
    if (!detail) return;
    const current = this.growthCriterionEvaluation(criterion.id);
    const reference = `${questionId}: ${detail}`;
    if (current.evidence.includes(reference)) return;
    this.updateGrowthCriterion(criterion.id, {
      evidence: [current.evidence.trim(), reference].filter(Boolean).join('\n'),
      linkedQuestionIds: [...new Set([...(current.linkedQuestionIds ?? []), questionId])],
    });
  }

  growthCriterionStateLabel(criterion: GrowthCriterion): string {
    const observed = this.growthEvaluation().criteria[criterion.id];
    if (observed?.sourceInvalidated) return 'Fuente de entrevista modificada · revisar evidencia';
    const state = growthRequirementState(criterion, observed);
    if (state === 'passed') return 'Cumplido con evidencia';
    if (state === 'unmet') return 'No cumplido con evidencia';
    return observed?.status === 'declared' ? 'Declarado · requiere verificación'
      : observed?.status === 'not_applicable' ? 'No aplica · no confirma requisito'
        : 'Pendiente o evidencia incompleta';
  }

  growthRequirementLabel(state: 'passed' | 'unmet' | 'unknown'): string {
    return state === 'passed' ? 'Cumplido con evidencia'
      : state === 'unmet' ? 'No cumplido con evidencia' : 'Pendiente o evidencia insuficiente';
  }

  growthLevelName(levelId: GrowthLevelId | null): string {
    return this.growthLevels.find((level) => level.id === levelId)?.name ?? 'Sin nivel confirmado';
  }

  growthConfidenceLabel(confidence: 'low' | 'medium' | 'high' | 'insufficient'): string {
    return confidence === 'high' ? 'Alta'
      : confidence === 'medium' ? 'Media'
        : confidence === 'low' ? 'Baja' : 'Insuficiente';
  }

  updateGrowthReviewNote(value: string): void {
    const session = this.session();
    if (session) this.persist({
      ...session,
      growthReviewNote: value,
      growthClassificationApproved: false,
    });
  }

  approveGrowthClassification(): void {
    const session = this.session();
    if (!session || (session.growthReviewNote ?? '').trim().length < 12) return;
    this.persist({ ...session, growthClassificationApproved: true });
  }

  updateAssessment(dimensionId: string, update: DimensionAssessment): void {
    const session = this.session();
    const form = this.formDefinition();
    if (!session || !form) return;
    const assessments = { ...session.assessments, [dimensionId]: update };
    const updatedSession = { ...session, assessments };
    const computed = assessMaturity(form, assessments);
    const generated = recommendServices(form, computed);
    const recommendations = Object.fromEntries(Object.entries(generated).map(([id, recommendation]) => {
      const existing = session.recommendations[id];
      return [id, existing
        ? existing.advisorEdited
          ? { ...recommendation, ...existing }
          : recommendation
        : recommendation];
    }));
    this.persist({ ...updatedSession, recommendations });
  }

  patchAssessment(dimensionId: string, patch: Partial<DimensionAssessment>): void {
    const existing = this.session()?.assessments[dimensionId] ?? emptyAssessment();
    this.updateAssessment(dimensionId, { ...existing, ...patch });
  }

  setManualLevel(value: string): void {
    const session = this.session();
    if (!session) return;
    const levelId = value === '' ? null : Number(value);
    this.persist({ ...session, manualLevelId: levelId });
  }

  updateManualJustification(value: string): void {
    const session = this.session();
    if (session) this.persist({ ...session, manualLevelJustification: value });
  }

  updateRecommendation(
    serviceId: string,
    patch: Partial<{ status: RecommendationStatus; selected: boolean; justification: string }>,
  ): void {
    const session = this.session();
    const form = this.formDefinition();
    const result = this.result();
    if (!session || !form || !result) return;
    const fallback = recommendServices(form, result)[serviceId];
    const current = session.recommendations[serviceId] ?? fallback;
    if (!current) return;
    this.persist({
      ...session,
      recommendations: {
        ...session.recommendations,
        [serviceId]: { ...current, ...patch, advisorEdited: true },
      },
    });
  }

  updateSessionField(
    field: 'initiativeComplexity' | 'internalCapacity' | 'delegatedResponsibilities' | 'budgetAndTimeline',
    value: string,
  ): void {
    const session = this.session();
    if (session) this.persist({ ...session, [field]: value });
  }

  updateExecutiveSummary(field: keyof ExecutiveSummary, value: string): void {
    const session = this.session();
    if (!session) return;
    this.persist({
      ...session,
      executiveSummary: { ...emptyExecutiveSummary(), ...session.executiveSummary, [field]: value },
      executiveSummaryApproved: false,
    });
  }

  approveExecutiveSummary(): void {
    const session = this.session();
    if (session) this.persist({ ...session, executiveSummaryApproved: true });
  }

  executiveSummary(session: DiscoverySession): ExecutiveSummary {
    return { ...emptyExecutiveSummary(), ...session.executiveSummary };
  }

  addAction(): void {
    if (this.actionForm.invalid) {
      this.actionForm.markAllAsTouched();
      return;
    }
    const session = this.session();
    if (!session) return;
    const value = this.actionForm.getRawValue();
    const action: RoadmapAction = {
      ...value,
      id: crypto.randomUUID(),
      expectedEvidence: value.expectedEvidence,
      status: 'pending',
    };
    this.persist({ ...session, actions: [...session.actions, action] });
    this.actionForm.reset({ title: '', owner: '', dueDate: '', expectedEvidence: '', priority: 'medium', horizon: 30 });
  }

  updateAction(actionId: string, patch: Partial<RoadmapAction>): void {
    const session = this.session();
    if (!session) return;
    this.persist({ ...session, actions: session.actions.map((action) => action.id === actionId ? { ...action, ...patch } : action) });
  }

  removeAction(actionId: string): void {
    const session = this.session();
    if (session && globalThis.confirm('¿Eliminar esta acción del roadmap?')) {
      this.persist({ ...session, actions: session.actions.filter((action) => action.id !== actionId) });
    }
  }

  definitionFor(serviceId: string) {
    return serviceById(serviceId);
  }

  printReport(): void {
    globalThis.print();
  }

  async printCombinedReports(): Promise<void> {
    const session = this.session();
    if (!session || !this.proposalApprovedForSharing()) {
      this.notice = 'El PDF combinado requiere una propuesta aprobada internamente.';
      return;
    }
    await this.router.navigate(['/session', session.id, 'combined-report']);
    globalThis.setTimeout(() => globalThis.print(), 100);
  }

  async startProposal(): Promise<void> {
    const session = this.session();
    if (!session) return;
    const updated = session.commercialProposal
      ? { ...session, commercialProposal: migrateCommercialProposal(session.commercialProposal) }
      : { ...session, commercialProposal: createCommercialProposal() };
    try {
      await this.store.save(updated);
      await this.router.navigate(['/session', session.id, 'proposal']);
    } catch (error) {
      this.notice = error instanceof Error ? `No se pudo preparar la propuesta: ${error.message}` : 'No se pudo preparar la propuesta.';
    }
  }

  updateProposal(patch: Partial<CommercialProposal>): void {
    const session = this.session();
    if (!session) return;
    const current = session.commercialProposal
      ? migrateCommercialProposal(session.commercialProposal)
      : createCommercialProposal();
    const workflowTransition = patch.status !== undefined;
    this.persist({
      ...session,
      commercialProposal: {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
        status: workflowTransition ? patch.status! : 'estimation_incomplete',
        internalApproval: workflowTransition
          ? ['internally_approved', 'shared_with_client', 'accepted', 'rejected'].includes(patch.status!)
            ? patch.internalApproval ?? current.internalApproval
            : { approved: false, note: '', approvedAt: '' }
          : { ...current.internalApproval, approved: false, approvedAt: '' },
      },
    });
  }

  updateAlternative(patch: Partial<CommercialAlternative>): void {
    const proposal = this.commercialProposal();
    const active = this.activeAlternative();
    if (!proposal || !active) return;
    this.updateProposal({
      alternatives: proposal.alternatives.map((item) => item.id === active.id ? { ...item, ...patch } : item),
    });
  }

  selectAlternative(id: ProposalOptionId): void {
    const proposal = this.commercialProposal();
    if (proposal) this.updateProposal({ selectedAlternativeId: id });
  }

  addCommercialService(serviceId: string): void {
    const service = COMMERCIAL_SERVICES.find((item) => item.id === serviceId);
    const active = this.activeAlternative();
    const proposal = this.commercialProposal();
    const pricing = proposal?.servicePricing[serviceId as CommercialServiceId];
    if (!service || !active || !pricing || active.lines.some((line) => line.serviceId === service.id)) return;
    const activitiesEstimate: ServiceActivity[] = Object.entries(pricing.hoursByProfile)
      .filter(([, hours]) => hours !== undefined && hours > 0)
      .map(([profileId, hours]) => ({
        id: `reference-${profileId}`,
        name: `Estimación inicial · ${this.commercialProfileName(profileId)}`,
        profileId: profileId as CommercialRoleId,
        hours: { min: hours!, expected: hours!, max: hours! },
        assumptions: ['Estimación interna inicial y editable; no constituye un compromiso contractual.'],
        uncertainty: 'high',
      }));
    const line: CommercialServiceLine = {
      id: crypto.randomUUID(),
      serviceId: service.id,
      serviceSnapshot: structuredClone(service),
      quantity: service.defaultQuantity,
      priceReviewed: false,
      objective: service.objective,
      scopeNotes: `${pricing.includedScope}\n${service.activities.join('\n')}`,
      calendarDuration: { ...service.calendarDuration },
      deliverables: structuredClone(service.deliverables),
      exclusions: [...pricing.exclusions],
      activitiesEstimate,
      thirdPartyCostCOP: 0,
      otherDirectCostCOP: pricing.estimatedDirectCostCOP,
      thirdPartyChargeCOP: 0,
      proposedUnitPriceCOP: pricing.referencePriceCOP,
      actualHoursByProfile: {},
      taxTreatment: proposal.settings.taxTreatments[service.id],
      discountEligible: service.discountEligible,
      dependencyNote: '',
    };
    this.updateAlternative({ lines: [...active.lines, line] });
  }

  updateCommercialLine(lineId: string, patch: Partial<CommercialServiceLine>): void {
    const active = this.activeAlternative();
    if (!active) return;
    this.updateAlternative({
      lines: active.lines.map((line) => line.id === lineId ? { ...line, ...patch } : line),
    });
  }

  updateCommercialPrice(lineId: string, value: string): void {
    const price = this.optionalNumber(value);
    if (price !== null && price < 0) return;
    this.updateCommercialLine(lineId, { proposedUnitPriceCOP: price, priceReviewed: false });
  }

  updateCommercialLineDeliverable(
    lineId: string,
    deliverableId: string,
    patch: Partial<CommercialServiceLine['deliverables'][number]>,
  ): void {
    const line = this.activeAlternative()?.lines.find((item) => item.id === lineId);
    if (!line) return;
    this.updateCommercialLine(lineId, {
      deliverables: line.deliverables.map((item) => item.id === deliverableId ? { ...item, ...patch } : item),
    });
  }

  updateCommercialCalendarDuration(
    lineId: string,
    field: 'minDays' | 'expectedDays' | 'maxDays',
    value: string,
  ): void {
    const line = this.activeAlternative()?.lines.find((item) => item.id === lineId);
    if (!line) return;
    const days = this.optionalNumber(value);
    if (days !== null && days < 0) return;
    this.updateCommercialLine(lineId, {
      calendarDuration: { ...line.calendarDuration, [field]: days },
    });
  }

  updateCommercialActivity(
    lineId: string,
    activityId: string,
    scenario: 'min' | 'expected' | 'max',
    value: string,
  ): void {
    const line = this.activeAlternative()?.lines.find((item) => item.id === lineId);
    if (!line) return;
    const hours = value === '' ? null : Number(value);
    if (hours !== null && (!Number.isFinite(hours) || hours < 0)) return;
    this.updateCommercialLine(lineId, {
      activitiesEstimate: line.activitiesEstimate.map((item) => item.id === activityId
        ? { ...item, hours: { ...item.hours, [scenario]: hours } }
        : item),
    });
  }

  updateCommercialActivitySharing(
    lineId: string,
    activityId: string,
    field: 'sharedActivityKey' | 'sharedActivityJustification',
    value: string,
  ): void {
    const line = this.activeAlternative()?.lines.find((item) => item.id === lineId);
    if (!line) return;
    this.updateCommercialLine(lineId, {
      activitiesEstimate: line.activitiesEstimate.map((item) => item.id === activityId
        ? { ...item, [field]: value }
        : item),
    });
  }

  removeCommercialService(lineId: string): void {
    const active = this.activeAlternative();
    if (active) this.updateAlternative({ lines: active.lines.filter((line) => line.id !== lineId) });
  }

  updateProfileCost(profileId: string, value: string): void {
    const proposal = this.commercialProposal();
    if (!proposal) return;
    const cost = this.optionalNumber(value);
    if (cost !== null && cost < 0) return;
    this.updateProposal({
      settings: {
        ...proposal.settings,
        profiles: proposal.settings.profiles.map((profile) => profile.id === profileId
          ? { ...profile, hourlyCostCOP: cost }
          : profile),
      },
    });
  }

  updateProfileCommercialRate(profileId: string, value: string): void {
    const proposal = this.commercialProposal();
    if (!proposal) return;
    const cost = this.optionalNumber(value);
    if (cost !== null && cost < 0) return;
    this.updateProposal({
      settings: {
        ...proposal.settings,
        profiles: proposal.settings.profiles.map((profile) => profile.id === profileId
          ? { ...profile, commercialHourlyRateCOP: cost }
          : profile),
      },
    });
  }

  updateCommercialSetting(
    setting: 'indirectCostPercent' | 'contingencyPercent' | 'targetMarginPercent' | 'minimumAuthorizedMarginPercent'
      | 'defaultDiscountPercent' | 'maximumDiscountPercent' | 'quoteValidityDays' | 'taxPercent' | 'withholdingPercent',
    value: string,
  ): void {
    const proposal = this.commercialProposal();
    if (!proposal) return;
    const number = this.optionalNumber(value);
    const max = setting === 'quoteValidityDays' ? 365 : 100;
    if (number !== null && (number < 0 || number > max)) return;
    if (setting === 'defaultDiscountPercent' && number !== null && number > proposal.settings.maximumDiscountPercent) return;
    if (setting === 'maximumDiscountPercent' && number !== null && number < proposal.settings.defaultDiscountPercent) return;
    const defaults: Record<typeof setting, number | null> = {
      indirectCostPercent: 0,
      contingencyPercent: 10,
      targetMarginPercent: 40,
      minimumAuthorizedMarginPercent: 25,
      defaultDiscountPercent: 0,
      maximumDiscountPercent: 15,
      quoteValidityDays: 15,
      taxPercent: null,
      withholdingPercent: null,
    };
    const configuredValue = number ?? defaults[setting];
    const alternatives = proposal.alternatives.map((alternative) => {
      if (setting === 'defaultDiscountPercent' && alternative.discountPercent === proposal.settings.defaultDiscountPercent) {
        return { ...alternative, discountPercent: configuredValue ?? 0 };
      }
      return alternative;
    });
    const validUntil = setting === 'quoteValidityDays' && configuredValue !== null
      ? (() => {
        const date = new Date(proposal.createdAt);
        date.setDate(date.getDate() + configuredValue);
        return date.toISOString().slice(0, 10);
      })()
      : proposal.validUntil;
    this.updateProposal({
      ...(setting === 'defaultDiscountPercent' ? { alternatives } : {}),
      ...(setting === 'quoteValidityDays' ? { validUntil } : {}),
      settings: {
        ...proposal.settings,
        [setting]: configuredValue,
        ...(setting === 'indirectCostPercent' ? { indirectCostConfigured: number !== null } : {}),
      },
    });
  }

  updateTaxValidation(validated: boolean): void {
    const proposal = this.commercialProposal();
    if (proposal) this.updateProposal({
      settings: { ...proposal.settings, taxValidationStatus: validated ? 'validated' : 'pending' },
    });
  }

  updateIndirectCostValidation(configured: boolean): void {
    const proposal = this.commercialProposal();
    if (proposal) this.updateProposal({
      settings: { ...proposal.settings, indirectCostConfigured: configured },
    });
  }

  updateTaxTreatment(serviceId: CommercialServiceId, taxTreatment: TaxTreatment): void {
    const proposal = this.commercialProposal();
    if (proposal) this.updateProposal({
      settings: { ...proposal.settings, taxTreatments: { ...proposal.settings.taxTreatments, [serviceId]: taxTreatment } },
    });
  }

  updateSuggestedPaymentTerms(value: string): void {
    const proposal = this.commercialProposal();
    if (!proposal) return;
    this.updateProposal({
      alternatives: proposal.alternatives.map((alternative) => (
        alternative.paymentTerms === proposal.settings.suggestedPaymentTerms
          ? { ...alternative, paymentTerms: value }
          : alternative
      )),
      settings: { ...proposal.settings, suggestedPaymentTerms: value },
    });
  }

  updateServicePricing(serviceId: CommercialServiceId, patch: Partial<CommercialServicePricing>): void {
    const proposal = this.commercialProposal();
    const current = proposal?.servicePricing[serviceId];
    if (!proposal || !current) return;
    this.updateProposal({
      servicePricing: {
        ...proposal.servicePricing,
        [serviceId]: { ...current, ...patch, status: 'estimated', lastModified: new Date().toISOString() },
      },
    });
  }

  updateServiceReferencePrice(serviceId: CommercialServiceId, value: string): void {
    const amount = this.optionalNumber(value);
    if (amount === null || amount < 0) return;
    this.updateServicePricing(serviceId, { referencePriceCOP: amount });
  }

  updateServiceDirectCost(serviceId: CommercialServiceId, value: string): void {
    const amount = this.optionalNumber(value);
    if (amount === null || amount < 0) return;
    this.updateServicePricing(serviceId, { estimatedDirectCostCOP: amount });
  }

  commercialPricingEstimate(serviceId: CommercialServiceId): {
    costCOP: number | null;
    targetPriceCOP: number | null;
    marginPercent: number | null;
    provisional: boolean;
  } {
    const proposal = this.commercialProposal();
    const pricing = proposal?.servicePricing[serviceId];
    if (!proposal || !pricing) return { costCOP: null, targetPriceCOP: null, marginPercent: null, provisional: true };
    let labor = 0;
    for (const [profileId, hours] of Object.entries(pricing.hoursByProfile) as [CommercialRoleId, number][]) {
      const profile = proposal.settings.profiles.find((item) => item.id === profileId);
      if (!profile || profile.hourlyCostCOP === null) {
        return { costCOP: null, targetPriceCOP: null, marginPercent: null, provisional: true };
      }
      labor += profile.hourlyCostCOP * hours;
    }
    const operating = labor + pricing.estimatedDirectCostCOP
      + labor * proposal.settings.indirectCostPercent / 100;
    const costCOP = Math.round(operating * (1 + proposal.settings.contingencyPercent / 100));
    const targetPriceCOP = proposal.settings.targetMarginPercent < 100
      ? Math.round(costCOP / (1 - proposal.settings.targetMarginPercent / 100))
      : null;
    return {
      costCOP,
      targetPriceCOP,
      marginPercent: pricing.referencePriceCOP > 0
        ? ((pricing.referencePriceCOP - costCOP) / pricing.referencePriceCOP) * 100
        : null,
      provisional: !proposal.settings.indirectCostConfigured,
    };
  }

  updateServiceHours(serviceId: CommercialServiceId, profileId: CommercialRoleId, value: string): void {
    const proposal = this.commercialProposal();
    const pricing = proposal?.servicePricing[serviceId];
    const hours = this.optionalNumber(value);
    if (!pricing || hours === null || hours < 0) return;
    const hoursByProfile = { ...pricing.hoursByProfile };
    if (hours === 0) delete hoursByProfile[profileId];
    else hoursByProfile[profileId] = hours;
    this.updateServicePricing(serviceId, { hoursByProfile });
  }

  updateServiceScope(serviceId: CommercialServiceId, value: string): void {
    this.updateServicePricing(serviceId, { includedScope: value });
  }

  updateServiceUnit(serviceId: CommercialServiceId, value: string): void {
    this.updateServicePricing(serviceId, { unit: value });
  }

  updateServiceExclusions(serviceId: CommercialServiceId, value: string): void {
    this.updateServicePricing(serviceId, { exclusions: value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) });
  }

  updateActualHours(lineId: string, profileId: CommercialRoleId, value: string): void {
    const line = this.activeAlternative()?.lines.find((item) => item.id === lineId);
    if (!line) return;
    const hours = this.optionalNumber(value);
    if (hours !== null && hours < 0) return;
    const actualHoursByProfile = { ...line.actualHoursByProfile };
    if (hours === null) delete actualHoursByProfile[profileId];
    else actualHoursByProfile[profileId] = hours;
    this.updateCommercialLine(lineId, { actualHoursByProfile });
  }

  exportCommercialConfiguration(): void {
    const proposal = this.commercialProposal();
    if (!proposal) return;
    this.downloadJson(
      serializeCommercialConfiguration(proposal),
      `metamag-configuracion-comercial-${slug(this.session()?.project ?? '')}.json`,
      true,
    );
  }

  async importCommercialConfiguration(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const proposal = this.commercialProposal();
    if (!file || !proposal) return;
    try {
      const payload: unknown = JSON.parse(await file.text());
      const imported = parseCommercialConfiguration(payload);
      this.updateProposal({
        settings: imported.settings,
        servicePricing: imported.servicePricing,
        status: 'estimation_incomplete',
      });
      this.notice = 'Configuración comercial importada y guardada en esta sesión. Verifica los datos tributarios antes de cotizar.';
    } catch (error) {
      this.notice = error instanceof Error ? `No se importó la configuración: ${error.message}` : 'No se importó la configuración por un error inesperado.';
    }
  }

  updateCommercialCost(
    lineId: string,
    field: 'thirdPartyCostCOP' | 'otherDirectCostCOP' | 'thirdPartyChargeCOP',
    value: string,
  ): void {
    const number = this.optionalNumber(value);
    if (number !== null && number < 0) return;
    this.updateCommercialLine(lineId, { [field]: number });
  }

  formatCOP(value: number | null | undefined): string {
    return value === null || value === undefined
      ? 'Por configurar'
      : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
  }

  proposalStatusText(status: ProposalStatus): string {
    return proposalStatusLabel(status);
  }

  proposalRevisionAlternativeName(revision: ProposalRevision): string {
    return revision.alternatives.find((item) => item.id === revision.selectedAlternativeId)?.name ?? revision.selectedAlternativeId;
  }

  commercialServiceName(serviceId: CommercialServiceLine['serviceId']): string {
    return getCommercialService(serviceId)?.name ?? serviceId;
  }

  commercialServiceDefinition(serviceId: CommercialServiceLine['serviceId']): CommercialService | undefined {
    return getCommercialService(serviceId);
  }

  updateDiscountPercent(value: string): void {
    const discountPercent = Number(value);
    if (Number.isFinite(discountPercent) && discountPercent >= 0 && discountPercent <= 100) {
      this.updateAlternative({ discountPercent });
    }
  }

  commercialDependencies(alternative: CommercialAlternative): string {
    return alternative.lines.map((line) => line.dependencyNote).filter(Boolean).join(' · ');
  }

  splitLines(value: string): string[] {
    return value.split(/\r?\n/);
  }

  setDiscountApproval(approved: boolean): void {
    const proposal = this.commercialProposal();
    if (proposal) {
      this.updateProposal({
        discountApproval: {
          ...proposal.discountApproval,
          approved,
          declaredAt: approved ? new Date().toISOString() : '',
        },
      });
    }
  }

  updateDiscountDeclaration(field: 'responsible' | 'justification', value: string): void {
    const proposal = this.commercialProposal();
    if (proposal) this.updateProposal({
      discountApproval: { ...proposal.discountApproval, [field]: value },
    });
  }

  setInternalApprovalNote(note: string): void {
    const proposal = this.commercialProposal();
    if (proposal) {
      this.updateProposal({
        internalApproval: { ...proposal.internalApproval, note },
      });
    }
  }

  commercialProfileName(profileId: string): string {
    return this.commercialProposal()?.settings.profiles.find((profile) => profile.id === profileId)?.name ?? profileId;
  }

  commercialProfileCost(profileId: CommercialRoleId, hours: HourSummary): number | null {
    const profile = this.commercialProposal()?.settings.profiles.find((item) => item.id === profileId);
    const profileHours = hours.byProfile[profileId];
    return profile?.hourlyCostCOP === null || profile?.hourlyCostCOP === undefined || profileHours === undefined
      ? null
      : Math.round(profile.hourlyCostCOP * profileHours);
  }

  commercialActualProfileCost(profileId: CommercialRoleId, hours: number | undefined): number | null {
    const profile = this.commercialProposal()?.settings.profiles.find((item) => item.id === profileId);
    return hours === undefined || profile?.hourlyCostCOP === null || profile?.hourlyCostCOP === undefined
      ? null
      : Math.round(profile.hourlyCostCOP * hours);
  }

  commercialLineHours(
    alternative: CommercialAlternative,
    line: CommercialServiceLine,
    scenario: EstimateScenario,
  ): number {
    const seenShared = new Set<string>();
    for (const previous of alternative.lines) {
      if (previous.id === line.id) break;
      previous.activitiesEstimate.forEach((activity) => {
        const key = activity.sharedActivityKey?.trim();
        if (key) seenShared.add(key);
      });
    }
    let total = 0;
    for (const activity of line.activitiesEstimate) {
      const key = activity.sharedActivityKey?.trim();
      if (key && seenShared.has(key)) continue;
      if (key) seenShared.add(key);
      const hours = scenario === 'optimistic'
        ? activity.hours.min
        : scenario === 'conservative' ? activity.hours.max : activity.hours.expected;
      total += (hours ?? 0) * line.quantity;
    }
    return total;
  }

  scenarioLabel(scenario: 'optimistic' | 'base' | 'conservative'): string {
    return scenario === 'optimistic' ? 'Optimista' : scenario === 'base' ? 'Base' : 'Conservador';
  }

  async saveProposalRevision(): Promise<void> {
    const session = this.session();
    const proposal = this.commercialProposal();
    if (!session || !proposal) return;
    const revision = createProposalRevision(proposal);
    try {
      await this.store.save({
        ...session,
        commercialProposal: {
          ...proposal,
          updatedAt: revision.savedAt,
          revisions: [...proposal.revisions, revision],
        },
      });
      this.notice = `Versión ${revision.id.slice(0, 8)} guardada.`;
    } catch (error) {
      this.notice = error instanceof Error ? `No se guardó la versión: ${error.message}` : 'No se guardó la versión.';
    }
  }

  async restoreProposalRevision(revisionId: string): Promise<void> {
    const session = this.session();
    const proposal = this.commercialProposal();
    const revision = proposal?.revisions.find((item) => item.id === revisionId);
    if (!session || !proposal || !revision) return;
    const currentRevision = createProposalRevision(proposal);
    try {
      await this.store.save({
        ...session,
        commercialProposal: {
          ...proposal,
          catalogVersion: revision.catalogVersion,
          updatedAt: new Date().toISOString(),
          status: 'estimation_incomplete',
          selectedAlternativeId: revision.selectedAlternativeId,
          validUntil: revision.validUntil,
          settings: structuredClone(revision.settings),
          servicePricing: structuredClone(revision.servicePricing),
          alternatives: structuredClone(revision.alternatives),
          advisorNote: revision.advisorNote,
          taxNote: revision.taxNote,
          discountApproval: structuredClone(revision.discountApproval),
          internalApproval: { ...revision.internalApproval, approved: false, approvedAt: '' },
          clientStatusNote: revision.clientStatusNote,
          revisions: [...proposal.revisions, currentRevision],
        },
      });
      this.notice = `Se restauró la versión ${revision.id.slice(0, 8)}. Requiere nueva revisión interna.`;
    } catch (error) {
      this.notice = error instanceof Error ? `No se restauró la versión: ${error.message}` : 'No se restauró la versión.';
    }
  }

  requestProposalReview(): void {
    const proposal = this.commercialProposal();
    const calculation = this.commercialCalculation();
    if (!proposal || !calculation) return;
    if (calculation.blockers.length) {
      this.notice = 'Completa los requisitos pendientes antes de enviar a revisión.';
      return;
    }
    this.updateProposal({ status: 'pending_review' });
  }

  approveProposalInternally(): void {
    const proposal = this.commercialProposal();
    const calculation = this.commercialCalculation();
    if (!proposal || !calculation) return;
    if (calculation.blockers.length) {
      this.notice = 'No se puede aprobar: resuelve los requisitos pendientes primero.';
      return;
    }
    if (calculation.warnings.length && proposal.internalApproval.note.trim().length < 15) {
      this.notice = 'Registra una revisión interna de al menos 15 caracteres para atender las alertas antes de aprobar.';
      return;
    }
    this.updateProposal({
      status: 'internally_approved',
      internalApproval: {
        approved: true,
        note: proposal.internalApproval.note,
        approvedAt: new Date().toISOString(),
      },
    });
  }

  shareProposal(): void {
    const proposal = this.commercialProposal();
    if (!proposal || proposal.status !== 'internally_approved' || !proposal.internalApproval.approved) {
      this.notice = 'La propuesta debe tener aprobación interna antes de marcarse como compartida.';
      return;
    }
    this.updateProposal({ status: 'shared_with_client' });
  }

  markClientDecision(status: 'accepted' | 'rejected'): void {
    const proposal = this.commercialProposal();
    if (!proposal || proposal.status !== 'shared_with_client') return;
    this.updateProposal({ status });
  }

  private optionalNumber(value: string): number | null {
    if (value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  saveInternalJson(): void {
    const session = this.session();
    if (!session) return;
    this.downloadJson(session, `metamag-interno-${slug(session.project)}.json`);
  }

  private downloadJson(value: unknown, filename: string, isSerialized = false): void {
    const url = URL.createObjectURL(new Blob([isSerialized ? value as string : JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  dimensionName(id: string): string {
    return this.formDefinition()?.dimensions.find((dimension) => dimension.id === id)?.name ?? id;
  }

  evidenceLabel(id: string): string {
    return this.formDefinition()?.responseModel.evidenceLevels.find((level) => level.id === id)?.label ?? id;
  }

  confidenceLabel(value: string): string {
    return value === 'high' ? 'Alta' : value === 'medium' ? 'Media' : value === 'low' ? 'Baja' : 'Sin evaluar';
  }

  private saveCurrentResponse(value: Partial<QuestionResponse>): void {
    const session = this.session();
    const question = this.currentQuestion();
    if (!session || !question) return;
    const existing = session.responses[question.id] ?? emptyResponse();
    const responses = { ...session.responses, [question.id]: { ...existing, ...value } as QuestionResponse };
    const form = this.formDefinition();
    const previouslyVisible = this.interviewQuestions();
    const stillVisible = form
      ? new Set(questionsForInterview(form, { ...session, responses }).map((item) => item.id))
      : new Set<string>();
    const changedQuestionIds = new Set([
      question.id,
      ...previouslyVisible.filter((item) => !stillVisible.has(item.id)).map((item) => item.id),
    ]);
    const growthEvaluation = session.growthEvaluation;
    let growthClassificationApproved = session.growthClassificationApproved;
    if (growthEvaluation) {
      const updatedGrowthEvaluation = invalidateGrowthEvidenceForQuestions(growthEvaluation, changedQuestionIds);
      const invalidated = updatedGrowthEvaluation !== growthEvaluation;
      if (invalidated) growthClassificationApproved = false;
      this.persist({
        ...session,
        responses,
        growthEvaluation: updatedGrowthEvaluation,
        growthClassificationApproved,
      });
      return;
    }
    this.persist({
      ...session,
      responses,
    });
  }

  private persist(session: DiscoverySession): void {
    void this.store.save(session).catch((error: unknown) => {
      this.notice = error instanceof Error ? `No se guardaron los cambios: ${error.message}` : 'No se guardaron los cambios.';
    });
  }
}

function evaluationState(score: number | null): EvaluationState {
  if (score === null) return 'not_assessed';
  if (score === 0) return 'no_capacity';
  if (score === 1) return 'insufficient';
  return 'demonstrated';
}

function slug(value: string): string {
  return value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sesion';
}
