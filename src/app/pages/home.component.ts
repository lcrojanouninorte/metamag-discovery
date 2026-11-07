import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { createSession, DiscoverySession, FormDefinition } from '../core/domain';
import { createFictionalExampleSession } from '../core/example-report';
import { FormDefinitionService } from '../core/form-definition.service';
import { SessionStore } from '../core/session-store';

@Component({
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  template: `
    <div class="page-shell">
      <header class="topbar">
        <a class="brand" routerLink="/" aria-label="Metamag Discovery, inicio">
          <span class="brand-mark">M</span><span>METAMAG <strong>DISCOVERY</strong></span>
        </a>
        <span class="local-badge"><span aria-hidden="true">●</span> Almacenamiento local</span>
      </header>
      <main class="home-main">
        <section class="hero">
          <div class="eyebrow">Herramienta consultiva para asesores</div>
          <h1>Conversaciones que se convierten en <em>decisiones claras.</em></h1>
          <p>Conduce un diagnóstico basado en hechos, identifica capacidades demostradas y acuerda una ruta de evolución con tu cliente.</p>
          <button class="button button-primary button-large" type="button" (click)="toggleCreate()">
            <span aria-hidden="true">＋</span> Crear diagnóstico
          </button>
          @if (forms.form()?.formId === 'metamag-discovery-demo-2026') {
            <button class="button button-secondary" type="button" (click)="openExampleReport()">Ver ejemplo de informe</button>
          }
          <div class="privacy-note"><span aria-hidden="true">◇</span> Tus datos permanecen en este dispositivo. No se envían a ningún servidor.</div>
        </section>

        @if (showCreate && forms.form(); as form) {
          <section class="create-card" aria-labelledby="create-title">
            <div class="card-heading">
              <div><div class="eyebrow">Nueva sesión</div><h2 id="create-title">Configura la conversación</h2></div>
              <button class="icon-button" type="button" aria-label="Cerrar" (click)="showCreate = false">×</button>
            </div>
            <form [formGroup]="sessionForm" (ngSubmit)="create(form)">
              <div class="form-grid">
                <label>Cliente <input formControlName="clientName" autocomplete="name"></label>
                <label>Organización <input formControlName="organization" autocomplete="organization"></label>
                <label>Proyecto o producto <input formControlName="project"></label>
                <label>Asesor <input formControlName="advisor" autocomplete="name"></label>
                <label>Fecha de reunión <input type="date" formControlName="meetingDate"></label>
                <label>Tipo de producto <input formControlName="productType"></label>
                <label class="form-wide">Objetivo de la reunión <textarea rows="2" formControlName="objective"></textarea></label>
                <label class="form-wide">Estado conocido y antecedentes reportados <textarea rows="2" formControlName="knownState"></textarea></label>
                <label class="form-wide">Observaciones iniciales del asesor <textarea rows="2" formControlName="initialNotes"></textarea></label>
              </div>
              <div class="form-actions">
                <button class="button button-secondary" type="button" (click)="showCreate = false">Cancelar</button>
                <button class="button button-primary" type="submit" [disabled]="sessionForm.invalid">Iniciar entrevista <span aria-hidden="true">→</span></button>
              </div>
            </form>
          </section>
        }

        <section class="history-section" aria-labelledby="history-title">
          <div class="section-heading">
            <div><div class="eyebrow">Tu espacio de trabajo</div><h2 id="history-title">Diagnósticos recientes</h2></div>
            <div class="toolbar">
              <label class="button button-secondary upload-button">
                Cargar definición JSON
                <input type="file" accept="application/json,.json" (change)="importFormDefinition($event)" aria-label="Cargar definición de formulario JSON">
              </label>
              <label class="button button-secondary upload-button">
                Importar respaldo
                <input type="file" accept="application/json,.json" (change)="importBackup($event)" aria-label="Importar respaldo JSON">
              </label>
              <button class="button button-secondary" type="button" (click)="exportBackup()" [disabled]="!store.sessions().length">Exportar JSON</button>
            </div>
          </div>
          @if (store.loading()) {
            <p class="muted">Cargando sesiones locales…</p>
          } @else if (store.sessions().length === 0) {
            <div class="empty-state">
              <span class="empty-icon" aria-hidden="true">◌</span>
              <h3>Aún no hay diagnósticos</h3>
              <p>Inicia una sesión para preparar una conversación de descubrimiento. El formulario de demostración está listo y puedes cargar una definición propia desde JSON.</p>
              <button class="button button-secondary" type="button" (click)="toggleCreate()">Crear la primera sesión</button>
            </div>
          } @else {
            <div class="session-list">
              @for (session of store.sessions(); track session.id) {
                <article class="session-card">
                  <a class="session-main" [routerLink]="['/session', session.id, 'interview']">
                    <span class="avatar">{{ initials(session.clientName) }}</span>
                    <span class="session-copy">
                      <strong>{{ session.project || 'Proyecto sin nombre' }}</strong>
                      <span>{{ session.clientName }}{{ session.organization ? ' · ' + session.organization : '' }}</span>
                    </span>
                    <span class="session-date">{{ session.updatedAt | date:'d MMM y' }}</span>
                    <span class="session-arrow" aria-hidden="true">→</span>
                  </a>
                  <button class="icon-button delete-button" type="button" [attr.aria-label]="'Eliminar diagnóstico de ' + session.clientName" (click)="deleteSession(session)">×</button>
                </article>
              }
            </div>
          }
        </section>

        <footer class="home-footer">
          <div><span class="eyebrow">Metodología de diagnóstico</span><p>La ruta de cinco niveles se valida con evidencias. La contratación de servicios se decide por separado, según brechas, alcance y restricciones.</p></div>
          <div class="level-chips">
            <span>Nivel 1 · Exploración</span><span>Nivel 2 · Activación</span>
            <span>Nivel 3 · Tracción</span><span>Nivel 4 · Optimización</span><span>Nivel 5 · Escalamiento</span>
          </div>
        </footer>
        @if (notice) { <div class="toast" role="status">{{ notice }}</div> }
      </main>
    </div>
  `,
})
export class HomeComponent {
  readonly forms = inject(FormDefinitionService);
  readonly store = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;
  showCreate = false;
  private createFormInitialized = false;
  notice = '';
  readonly sessionForm = this.fb.group({
    clientName: ['', Validators.required],
    organization: [''],
    project: ['', Validators.required],
    advisor: [''],
    meetingDate: [new Date().toISOString().slice(0, 10), Validators.required],
    objective: [''],
    productType: [''],
    knownState: [''],
    initialNotes: [''],
  });

  create(form: FormDefinition): void {
    const values = this.sessionForm.getRawValue();
    const session: DiscoverySession = {
      ...createSession(form, values.advisor),
      ...values,
    };
    void this.store.save(session).then(() => this.router.navigate(['/session', session.id, 'interview'])).catch(() => undefined);
  }

  toggleCreate(): void {
    this.showCreate = !this.showCreate;
    if (this.showCreate && !this.createFormInitialized) {
      const form = this.forms.form();
      if (!form) return;
      this.sessionForm.patchValue({
        clientName: form.client.name,
        project: form.client.project,
        objective: form.client.objectivesReported.join('; '),
        productType: form.client.productType === 'book' ? 'Libro digital' : form.client.productType,
        knownState: `Fecha de lanzamiento reportada: ${form.client.launchDate || 'sin confirmar'}; ${
          form.client.reportedInitialSales === null
            ? 'ventas iniciales no reportadas'
            : `${form.client.reportedInitialSales} ventas iniciales reportadas`
        }; origen de compradores ${form.client.salesOriginVerified ? 'verificado' : 'no confirmado'}.`,
        initialNotes: form.client.notes,
      });
      this.createFormInitialized = true;
    }
  }

  async openExampleReport(): Promise<void> {
    const form = this.forms.form();
    if (!form || form.formId !== 'metamag-discovery-demo-2026') {
      this.notice = 'El ejemplo solo está disponible con el formulario público de demostración.';
      return;
    }
    try {
      const session = createFictionalExampleSession(form);
      await this.store.save(session);
      await this.router.navigate(['/session', session.id, 'client-report']);
    } catch (error) {
      this.notice = error instanceof Error ? `No fue posible abrir el informe de ejemplo: ${error.message}` : 'No fue posible abrir el informe de ejemplo.';
    }
  }

  initials(name: string): string {
    return name.split(/\s+/).slice(0, 2).map((word) => word.charAt(0)).join('').toLocaleUpperCase();
  }

  deleteSession(session: DiscoverySession): void {
    if (globalThis.confirm(`¿Eliminar permanentemente el diagnóstico de ${session.clientName} / ${session.project}? Esta acción no se puede deshacer.`)) {
      void this.store.delete(session.id).then(() => { this.notice = 'Diagnóstico eliminado del dispositivo.'; }).catch(() => undefined);
    }
  }

  async importBackup(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const count = await this.store.importBackup(JSON.parse(await file.text()) as unknown);
      this.notice = `${count} sesión${count === 1 ? '' : 'es'} importada${count === 1 ? '' : 's'}.`;
    } catch (error) {
      this.notice = error instanceof Error ? error.message : 'No fue posible importar el respaldo.';
    } finally {
      input.value = '';
    }
  }

  async importFormDefinition(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const definition = this.forms.setDefinition(JSON.parse(await file.text()) as unknown);
      this.createFormInitialized = false;
      this.sessionForm.reset({
        clientName: '',
        organization: '',
        project: '',
        advisor: '',
        meetingDate: new Date().toISOString().slice(0, 10),
        objective: '',
        productType: '',
        knownState: '',
        initialNotes: '',
      });
      this.notice = `Formulario "${definition.title}" cargado solo en esta pestaña. Las sesiones nuevas guardarán una copia local de la definición.`;
    } catch (error) {
      this.notice = error instanceof Error ? error.message : 'No fue posible cargar la definición.';
    } finally {
      input.value = '';
    }
  }

  exportBackup(): void {
    downloadJson('metamag-discovery-respaldo.json', this.store.exportBackup(this.store.sessions()));
  }
}

function downloadJson(filename: string, value: string): void {
  const url = URL.createObjectURL(new Blob([value], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
