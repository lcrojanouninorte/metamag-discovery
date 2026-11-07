import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormDefinition } from './domain';

@Injectable({ providedIn: 'root' })
export class FormDefinitionService {
  readonly form = signal<FormDefinition | null>(null);
  readonly error = signal('');

  constructor(private readonly http: HttpClient) {}

  async load(): Promise<void> {
    try {
      const form = await firstValueFrom(this.http.get<FormDefinition>('assets/forms/form-demo.json'));
      this.setDefinition(form);
      this.error.set('');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No fue posible cargar el formulario.');
      throw error;
    }
  }

  setDefinition(value: unknown): FormDefinition {
    if (!isFormDefinition(value)) {
      throw new Error('El archivo no contiene una definición de formulario Metamag Discovery válida.');
    }
    validateForm(value);
    this.form.set(value);
    return value;
  }
}

function isFormDefinition(value: unknown): value is FormDefinition {
  if (!value || typeof value !== 'object') return false;
  const form = value as Partial<FormDefinition>;
  return typeof form.formId === 'string' &&
    typeof form.schemaVersion === 'string' &&
    Array.isArray(form.sections) &&
    Array.isArray(form.dimensions) &&
    !!form.client &&
    !!form.maturityModel &&
    Array.isArray(form.maturityModel.levels);
}

function validateForm(form: FormDefinition): void {
  const questionIds = form.sections.flatMap((section) => section.questions.map((question) => question.id));
  const dimensionIds = form.dimensions.map((dimension) => dimension.id);
  if (!form.formId || new Set(questionIds).size !== questionIds.length) {
    throw new Error('El formulario debe tener un identificador y preguntas con IDs únicos.');
  }
  if (dimensionIds.length !== 6 || new Set(dimensionIds).size !== dimensionIds.length) {
    throw new Error('El formulario requiere seis dimensiones con identificadores únicos.');
  }
  for (const question of form.sections.flatMap((section) => section.questions)) {
    if (question.dimensionIds.some((id) => !dimensionIds.includes(id))) {
      throw new Error(`La pregunta ${question.id} referencia una dimensión inexistente.`);
    }
    if (question.condition && !questionIds.includes(question.condition.questionId)) {
      throw new Error(`La condición de ${question.id} referencia una pregunta inexistente.`);
    }
  }
}
