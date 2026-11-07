import { Injectable, signal } from '@angular/core';
import { DiscoverySession } from './domain';

const DATABASE_NAME = 'metamag-discovery';
const DATABASE_VERSION = 1;
const STORE_NAME = 'sessions';

@Injectable({ providedIn: 'root' })
export class SessionStore {
  readonly sessions = signal<DiscoverySession[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  private database?: Promise<IDBDatabase>;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor() {
    void this.load().catch((error: unknown) => this.report(error));
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const database = await this.openDatabase();
      const records = await request<DiscoverySession[]>(database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll());
      this.sessions.set(records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      this.error.set('');
    } finally {
      this.loading.set(false);
    }
  }

  async save(session: DiscoverySession): Promise<void> {
    const updated = { ...session, updatedAt: new Date().toISOString() };
    const database = await this.openDatabase();
    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      await request(database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(updated));
      this.sessions.update((items) => [updated, ...items.filter((item) => item.id !== updated.id)]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      this.error.set('');
    });
    try {
      await this.writeQueue;
    } catch (error) {
      this.report(error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const database = await this.openDatabase();
    const operation = this.writeQueue.catch(() => undefined).then(async () => {
      await request(database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id));
      this.sessions.update((items) => items.filter((item) => item.id !== id));
    });
    this.writeQueue = operation;
    try {
      await operation;
      this.error.set('');
    } catch (error) {
      this.report(error);
      throw error;
    }
  }

  async importBackup(file: unknown): Promise<number> {
    if (!isBackup(file)) throw new Error('El respaldo no tiene un formato Metamag Discovery válido.');
    const ids = new Set(this.sessions().map((session) => session.id));
    const imports = file.sessions.map((session) => {
      const id = ids.has(session.id) ? crypto.randomUUID() : session.id;
      ids.add(id);
      return { ...session, id };
    });
    for (const session of imports) await this.save(session);
    return imports.length;
  }

  exportBackup(sessions: DiscoverySession[]): string {
    return JSON.stringify({ backupVersion: '1.0.0', exportedAt: new Date().toISOString(), sessions }, null, 2);
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (!globalThis.indexedDB) return Promise.reject(new Error('Este navegador no permite IndexedDB; no es posible guardar sesiones localmente.'));
    this.database ??= new Promise((resolve, reject) => {
      const opening = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      opening.onupgradeneeded = () => opening.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => reject(opening.error ?? new Error('No fue posible abrir el almacenamiento local.'));
      opening.onblocked = () => reject(new Error('El almacenamiento está bloqueado por otra pestaña de Metamag Discovery.'));
    });
    return this.database;
  }

  private report(error: unknown): void {
    this.error.set(error instanceof Error ? error.message : 'Error inesperado en el almacenamiento local.');
  }
}

function request<T = void>(result: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    result.onsuccess = () => resolve(result.result);
    result.onerror = () => reject(result.error ?? new Error('Falló una operación de IndexedDB.'));
  });
}

function isBackup(value: unknown): value is { backupVersion: string; sessions: DiscoverySession[] } {
  if (!value || typeof value !== 'object') return false;
  const backup = value as { backupVersion?: unknown; sessions?: unknown };
  return backup.backupVersion === '1.0.0' &&
    Array.isArray(backup.sessions) &&
    backup.sessions.every((item) =>
      !!item &&
      typeof item === 'object' &&
      typeof (item as DiscoverySession).id === 'string' &&
      typeof (item as DiscoverySession).formId === 'string' &&
      typeof (item as DiscoverySession).responses === 'object' &&
      typeof (item as DiscoverySession).assessments === 'object',
    );
}
