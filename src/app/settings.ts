import { Component, inject, signal } from '@angular/core';
import { AdminApi } from './admin-api';

interface InventorySettings {
  editable: false;
  scope: 'inventory_operational_policy';
  inventory_policy: { commercial_enabled: boolean; sanitary_release_enabled: boolean };
}

@Component({
  selector: 'botica-admin-settings',
  template: `
    <header class="page-intro policy-intro">
      <h1>Políticas operativas de Inventario</h1>
      <p>Consulta las reglas vigentes para la venta y la liberación sanitaria de las existencias de BoticaYa.</p>
    </header>
    @if (loading()) { <div class="skeleton" role="status" aria-label="Cargando configuración"></div> }
    @else if (error()) { <p class="notice" role="alert">{{ error() }} <button type="button" (click)="load()">Reintentar</button></p> }
    @else if (settings(); as record) {
      <section aria-label="Políticas vigentes">
        <p class="policy-reading"><span aria-hidden="true">●</span> Solo lectura</p>
        <div class="policy-grid">
          <article class="card policy-card">
            <div class="policy-heading">
              <span class="policy-icon" aria-hidden="true">▤</span>
              <h2>Operaciones comerciales</h2>
            </div>
            <p class="policy-status" [class.policy-enabled]="record.inventory_policy.commercial_enabled">
              {{ record.inventory_policy.commercial_enabled ? 'Habilitadas por política' : 'Restringidas' }}
            </p>
            @if (record.inventory_policy.commercial_enabled) {
              <p>La política permite operaciones comerciales. Cada lote sigue sujeto a las validaciones de disponibilidad y autorización sanitaria.</p>
            } @else {
              <p>Las operaciones comerciales permanecen restringidas hasta que se apruebe su habilitación. Esto evita que las existencias se destinen a la venta antes de completar las validaciones requeridas.</p>
            }
          </article>
          <article class="card policy-card">
            <div class="policy-heading">
              <span class="policy-icon" aria-hidden="true">✚</span>
              <h2>Liberación sanitaria</h2>
            </div>
            <p class="policy-status" [class.policy-enabled]="record.inventory_policy.sanitary_release_enabled">
              {{ record.inventory_policy.sanitary_release_enabled ? 'Habilitada por política' : 'Desactivada' }}
            </p>
            <p>La cuarentena mantiene las existencias pendientes de revisión fuera del stock apto para venta. La liberación requiere una autorización sanitaria y un procedimiento aprobado para el lote.</p>
          </article>
        </div>
        <aside class="policy-note" aria-labelledby="inventory-integrity">
          <span class="policy-icon" aria-hidden="true">i</span>
          <div>
            <h2 id="inventory-integrity">Seguridad e integridad del inventario</h2>
            <p>Estas políticas ayudan a conservar la trazabilidad por lote y a distinguir las existencias físicas de las aptas para venta. Los estados reflejan la configuración vigente del sistema.</p>
          </div>
        </aside>
      </section>
    }
  `,
  styles: `
    .policy-intro { margin-block-end: 1.5rem; }
    .policy-intro p { max-width: 60ch; color: var(--muted); }
    .policy-reading { display: flex; align-items: center; gap: .5rem; margin-block-end: .85rem; color: var(--muted); font-size: .875rem; }
    .policy-reading span { color: var(--brand); font-size: .625rem; }
    .policy-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr)); gap: 1rem; }
    .policy-card { display: flex; flex-direction: column; align-items: flex-start; gap: .9rem; padding: clamp(1rem, 2.5vw, 1.55rem); }
    .policy-heading, .policy-note { display: flex; align-items: flex-start; gap: .8rem; }
    .policy-heading { align-items: center; }
    .policy-icon { display: grid; place-items: center; flex: 0 0 2.5rem; width: 2.5rem; height: 2.5rem; border-radius: .65rem; color: var(--brand); background: var(--mint); font-size: 1.2rem; font-weight: 700; }
    .policy-card h2, .policy-note h2 { margin: 0; }
    .policy-card p, .policy-note p { color: var(--muted); }
    .policy-card .policy-status { margin: 0; padding: .26rem .65rem; border-radius: 2rem; background: #fff2d4; color: #72420c; font-size: .875rem; font-weight: 700; }
    .policy-card .policy-enabled { background: var(--mint); color: #175337; }
    .policy-note { margin-block-start: 1rem; padding: clamp(1rem, 2.5vw, 1.4rem); border: 1px solid #c9e0d2; border-radius: var(--radius); background: #edf7f1; }
    .policy-note p { margin-block-start: .35rem; max-width: 74ch; }
  `,
})
export class SettingsPage {
  private readonly api = inject(AdminApi);
  protected readonly settings = signal<InventorySettings | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  constructor() { void this.load(); }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const { data } = await this.api.get<{ data: InventorySettings }>('settings');
      if (data?.scope !== 'inventory_operational_policy' || data.editable !== false ||
          typeof data.inventory_policy?.commercial_enabled !== 'boolean' ||
          typeof data.inventory_policy?.sanitary_release_enabled !== 'boolean') {
        throw new Error('La configuración devuelta por el backend no tiene el formato esperado.');
      }
      this.settings.set(data);
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
}
