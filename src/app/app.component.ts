import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormDefinitionService } from './core/form-definition.service';
import { SessionStore } from './core/session-store';

@Component({
  selector: 'md-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    @if (storage.error()) {
      <div class="storage-alert" role="alert">
        Almacenamiento local: {{ storage.error() }}
      </div>
    }
    @if (forms.error()) {
      <main class="load-error" role="alert">
        <h1>No se pudo abrir Metamag Discovery</h1>
        <p>{{ forms.error() }}</p>
        <button class="button button-primary" type="button" (click)="retry()">Reintentar</button>
      </main>
    } @else {
      <router-outlet />
    }
  `,
})
export class AppComponent implements OnInit {
  readonly forms = inject(FormDefinitionService);
  readonly storage = inject(SessionStore);

  ngOnInit(): void {
    void this.forms.load().catch(() => undefined);
  }

  retry(): void {
    void this.forms.load().catch(() => undefined);
  }
}
