import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
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

type SessionView = 'interview' | 'summary' | 'diagnosis' | 'client-report' | 'internal-report';

@Component({
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './session.component.html',
})
export class SessionComponent {
  readonly store = inject(SessionStore);
  readonly forms = inject(FormDefinitionService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly sessionId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly view = signal<SessionView>('interview');
  readonly selectedGrowthLevel = signal<GrowthLevelId>('exploracion');
  readonly formDefinition = computed(() => this.session()?.formSnapshot ?? this.forms.form());
  readonly session = computed(() => this.store.sessions().find((item) => item.id === this.sessionId) ?? null);
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
      this.view.set(requested === 'summary' || requested === 'diagnosis' || requested === 'client-report' || requested === 'internal-report'
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

  saveInternalJson(): void {
    const session = this.session();
    if (!session) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `metamag-interno-${slug(session.project)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
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
