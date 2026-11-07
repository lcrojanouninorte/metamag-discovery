import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  DiscoverySession,
  DimensionAssessment,
  EvidenceLevel,
  EvaluationState,
  emptyAssessment,
  emptyResponse,
  FormDefinition,
  QuestionStatus,
  QuestionResponse,
  RecommendationStatus,
  RoadmapAction,
} from '../core/domain';
import { assessMaturity, validateManualLevel } from '../core/assessment';
import { FormDefinitionService } from '../core/form-definition.service';
import { isQuestionVisible } from '../core/form-engine';
import { createClientReport } from '../core/report';
import { recommendServices, SERVICE_CATALOG, serviceById } from '../core/services.catalog';
import { SessionStore } from '../core/session-store';

type SessionView = 'interview' | 'diagnosis' | 'client-report' | 'internal-report';

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
  readonly formDefinition = computed(() => this.session()?.formSnapshot ?? this.forms.form());
  readonly session = computed(() => this.store.sessions().find((item) => item.id === this.sessionId) ?? null);
  readonly activeSection = computed(() =>
    this.formDefinition()?.sections.find((section) => section.id === this.session()?.activeSectionId) ?? null,
  );
  readonly visibleQuestions = computed(() => {
    const section = this.activeSection();
    const session = this.session();
    return section && session
      ? section.questions.filter((question) => isQuestionVisible(question, session.responses))
      : [];
  });
  readonly currentQuestion = computed(() => {
    const session = this.session();
    const questions = this.visibleQuestions();
    return questions.find((question) => question.id === session?.activeQuestionId) ?? questions[0] ?? null;
  });
  readonly currentIndex = computed(() => this.visibleQuestions().findIndex((question) => question.id === this.currentQuestion()?.id));
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
  readonly services = SERVICE_CATALOG;
  notice = '';

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const requested = params.get('view');
      this.view.set(requested === 'diagnosis' || requested === 'client-report' || requested === 'internal-report'
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
    const form = this.formDefinition();
    const session = this.session();
    const section = form?.sections.find((item) => item.id === sectionId);
    return section && session
      ? section.questions.filter((question) => isQuestionVisible(question, session.responses)).length
      : 0;
  }

  questionProgress(session: DiscoverySession, form: FormDefinition): string {
    const visible = form.sections.flatMap((section) => section.questions.filter((question) => isQuestionVisible(question, session.responses)));
    const answered = visible.filter((question) => {
      const response = session.responses[question.id];
      return response !== undefined && response.status !== 'pending';
    }).length;
    return `${answered} / ${visible.length}`;
  }

  questionProgressPercent(session: DiscoverySession, form: FormDefinition): number {
    const visible = form.sections.flatMap((section) => section.questions.filter((question) => isQuestionVisible(question, session.responses)));
    return visible.length
      ? visible.filter((question) => {
          const response = session.responses[question.id];
          return response !== undefined && response.status !== 'pending';
        }).length * 100 / visible.length
      : 0;
  }

  sectionIndex(form: FormDefinition, id: string): string {
    return String(form.sections.findIndex((section) => section.id === id) + 1).padStart(2, '0');
  }

  statusText(value: string): string {
    return value === 'answered' ? 'Respondida' : value === 'requires_verification' ? 'Por verificar' : value === 'not_applicable' ? 'No aplica' : 'Pendiente';
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
    const section = this.formDefinition()?.sections.find((item) => item.id === sectionId);
    const session = this.session();
    if (!section || !session) return 0;
    return section.questions.filter((question) => {
      const response = session.responses[question.id];
      return isQuestionVisible(question, session.responses) &&
        response !== undefined &&
        response.status !== 'pending';
    }).length;
  }

  setSection(sectionId: string): void {
    const form = this.formDefinition();
    const session = this.session();
    const section = form?.sections.find((item) => item.id === sectionId);
    if (!form || !session || !section) return;
    const first = section.questions.find((question) => isQuestionVisible(question, session.responses));
    this.persist({ ...session, activeSectionId: sectionId, activeQuestionId: first?.id ?? '' });
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
    this.persist({
      ...session,
      responses: { ...session.responses, [question.id]: { ...existing, ...value } as QuestionResponse },
    });
  }

  private persist(session: DiscoverySession): void {
    void this.store.save(session).catch(() => undefined);
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
