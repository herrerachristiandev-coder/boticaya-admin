import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi, CursorPage } from './admin-api';
import type { Movement } from './inventory-store';

const metrics = [
  { key: 'products', label: 'Productos con inventario habilitado' },
  { key: 'warehouses', label: 'Almacenes activos' },
  { key: 'lots', label: 'Lotes registrados' },
  { key: 'receipts', label: 'Recepciones registradas' },
] as const;
type Indicators = Record<(typeof metrics)[number]['key'], string>;
interface Overview {
  data: {
    inventory: Indicators;
    catalog: { registered:string; published:string; draft:string; archived:string; explicit_demo:string; verified_real:null } | null;
    operations: { suppliers:string; active_suppliers:string; quarantine_lots:string; expiring_exact_date_lots:string|null } | null;
  };
  extensions_available: boolean;
}

@Component({
  selector: 'botica-admin-dashboard',
  imports: [RouterLink],
  template: `
    <section class="page-intro"><h1>Resumen operativo</h1><p>Consulta la actividad de inventario de Botica Ya.</p></section>
    <section aria-label="Indicadores" [attr.aria-busy]="loading()">
      @if (error()) { <p class="notice" role="alert">{{ error() }} <button type="button" (click)="load()">Reintentar</button></p> }
      @else {
        <div class="metrics">@for (metric of metrics; track metric.key) {
          <article class="card metric"><h2>{{ metric.label }}</h2>
            @if (loading()) { <div class="skeleton" role="status" aria-label="Cargando indicador"></div> }
            @else if (indicators(); as data) { <strong>{{ data[metric.key] }}</strong> }
          </article>
        }</div>
      }
    </section>
    @if (overview(); as summary) {
      @if (summary.catalog; as catalog) {
        <section class="card section-panel"><h2>Catálogo compartido</h2>
          <p>{{ catalog.registered }} registrados · {{ catalog.published }} publicados · {{ catalog.draft }} borradores · {{ catalog.archived }} archivados</p>
          <p>{{ catalog.explicit_demo }} identificados como muestra. El estado de publicación no indica autorización de venta.</p>
        </section>
      }
      @if (summary.operations; as operations) {
        <section class="card section-panel"><h2>Proveedores y cuarentena</h2>
          <p>Proveedores activos: {{ operations.active_suppliers }} de {{ operations.suppliers }} · Lotes en cuarentena: {{ operations.quarantine_lots }}</p>
          @if (operations.expiring_exact_date_lots !== null) { <p>Lotes con fecha exacta dentro del intervalo: {{ operations.expiring_exact_date_lots }}</p> }
          <form class="module-filters" #windowForm (submit)="applyWindow($event,windowForm)">
            <label>Desde<input type="date" name="as_of" required></label>
            <label>Hasta<input type="date" name="expires_through" required></label>
            <button type="submit" [disabled]="loading()">Consultar vencimientos</button>
          </form>
          @if (intervalError()) { <p role="alert">{{ intervalError() }}</p> }
        </section>
      } @else if (!summary.extensions_available) {
        <p class="notice">Los totales de catálogo, proveedores y cuarentena requieren la extensión 021 del backend.</p>
      }
    }
    <section class="card section-panel" [attr.aria-busy]="movementsLoading()"><h2>Movimientos registrados</h2>
      @if (movementsLoading()) { <div class="skeleton" role="status" aria-label="Cargando movimientos"></div> }
      @else if (movementsError()) { <p class="notice" role="alert">{{ movementsError() }} <button type="button" (click)="loadMovements()">Reintentar</button></p> }
      @else if (!movements().length) { <p class="record-detail">Todavía no hay movimientos registrados.</p> }
      @else {
        <div class="table-scroll"><table><thead><tr><th scope="col">Fecha</th><th scope="col">ID de producto</th><th scope="col">Variación física</th></tr></thead>
          <tbody>@for (movement of movements(); track movement.id) {
            <tr><td>{{ movement.created_at }}</td><td>{{ movement.product_id }}</td><td>{{ movement.physical_delta }}</td></tr>
          }</tbody>
        </table></div>
      }
      <nav class="quick-links" aria-label="Movimientos"><a routerLink="/inventario/movimientos">Abrir historial</a></nav>
    </section>
    <section class="card section-panel"><h2>Seguimiento de inventario</h2>
      <nav class="quick-links" aria-label="Seguimiento">
        <a routerLink="/vencimientos">Vencimientos</a><a routerLink="/cuarentena">Cuarentena</a>
        <a routerLink="/inventario/movimientos">Movimientos</a><a routerLink="/inventario/stock">Existencias</a>
      </nav>
    </section>
  `,
})
export class DashboardPage implements OnInit {
  private readonly api = inject(AdminApi);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly indicators = signal<Indicators | null>(null);
  protected readonly overview = signal<Overview['data'] & {extensions_available:boolean} | null>(null);
  protected readonly intervalError = signal('');
  private interval = '';
  protected readonly metrics = metrics;
  protected readonly movements = signal<Movement[]>([]);
  protected readonly movementsLoading = signal(true);
  protected readonly movementsError = signal('');

  ngOnInit(): void { void this.load(); void this.loadMovements(); }

  protected applyWindow(event:Event, form:HTMLFormElement):void {
    event.preventDefault();
    const fields = new FormData(form);
    const asOf = String(fields.get('as_of') ?? '');
    const through = String(fields.get('expires_through') ?? '');
    this.intervalError.set('');
    if (!asOf || !through || through < asOf) { this.intervalError.set('Elige un intervalo de fechas válido.'); return; }
    this.interval = '?' + new URLSearchParams({as_of: asOf, expires_through: through}).toString();
    void this.load();
  }

  protected async loadMovements(): Promise<void> {
    this.movementsLoading.set(true);
    this.movementsError.set('');
    try {
      const page = await this.api.get<CursorPage<Movement>>('inventory/paged-movements?limit=10');
      if (!Array.isArray(page.data)) throw new Error('La respuesta de movimientos no tiene el formato esperado.');
      this.movements.set(page.data);
    } catch (error) {
      this.movementsError.set((error as Error).message);
    } finally {
      this.movementsLoading.set(false);
    }
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const overview = await this.api.get<Overview>('dashboard/indicators' + this.interval);
      const data = overview.data?.inventory;
      if (!data || !metrics.every(({ key }) => typeof data[key] === 'string' && /^\d+$/.test(data[key]))) {
        throw new Error('La respuesta de indicadores no tiene el formato esperado.');
      }
      this.indicators.set(data);
      this.overview.set({...overview.data,extensions_available:overview.extensions_available});
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
}
