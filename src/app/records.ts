import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, switchMap, tap } from 'rxjs';
import { ADMIN_PAGE_SIZE, AdminApi, CursorPage } from './admin-api';
import { AuthSession } from './auth-session';
import { printedExpiry } from './inventory-store';

type ColumnKey = 'name' | 'document_number' | 'code' | 'sku' | 'presentation_code' | 'factor_base_units'
  | 'product_id' | 'lot_number' | 'warehouse_id' | 'physical_base' | 'physical_delta' | 'physical_after'
  | 'reserved_after' | 'supplier_name' | 'document_reference' | 'quantity_base' | 'created_at' | 'expiry'
  | 'fullName' | 'email' | 'roles' | 'status' | 'active';
type RecordRow = Partial<Record<Exclude<ColumnKey, 'expiry' | 'active' | 'roles'>, string | number | null>> & {
  id?: string;
  active?: boolean;
  roles?: string[];
  expiry_precision?: string; expiry_year?: number | null; expiry_month?: number | null; expiry_day?: number | null;
};
interface SupplierDetail { id:string; name:string; document_number:string|null; active:boolean; version:string }
interface RecordView { title: string; path: string; columns: readonly [ColumnKey, string][]; search?: boolean }

const views: Partial<Record<string, RecordView>> = {
  categorias: { title: 'Categorías', path: 'catalog/categories', search: true, columns: [['name', 'Categoría']] },
  marcas: { title: 'Marcas', path: 'catalog/brands', search: true, columns: [['name', 'Marca']] },
  presentaciones: { title: 'Presentaciones', path: 'catalog/presentations', search: true, columns: [['sku', 'SKU'], ['presentation_code', 'Presentación'], ['factor_base_units', 'Unidades base']] },
  proveedores: { title: 'Proveedores', path: 'inventory/paged-suppliers', search: true, columns: [['name', 'Proveedor'], ['document_number', 'Documento'], ['active','Estado']] },
  trabajadores: { title: 'Trabajadores', path: 'workers', search: true, columns: [['fullName','Nombre'],['email','Correo'],['roles','Roles'],['status','Estado']] },
  almacenes: { title: 'Almacenes', path: 'inventory/paged-warehouses', columns: [['code', 'Código de sede'], ['name', 'Nombre del almacén']] },
  vencimientos: { title: 'Vencimientos', path: 'inventory/reports/expiring', columns: [['product_id', 'ID de producto'], ['lot_number', 'Lote'], ['expiry', 'Vencimiento impreso'], ['physical_base', 'Unidades base']] },
  kardex: { title: 'Kardex', path: 'inventory/reports/kardex', columns: [['created_at', 'Fecha'], ['product_id', 'ID de producto'], ['physical_delta', 'Movimiento'], ['physical_after', 'Saldo físico'], ['reserved_after', 'Reservado']] },
  trazabilidad: { title: 'Trazabilidad', path: 'inventory/reports/traceability', columns: [['document_reference', 'Documento'], ['supplier_name', 'Proveedor'], ['lot_number', 'Lote'], ['quantity_base', 'Unidades base'], ['expiry', 'Vencimiento impreso']] },
  cuarentena: { title: 'Cuarentena', path: 'inventory/management/quarantine', columns: [['product_id', 'ID de producto'], ['lot_number', 'Lote'], ['warehouse_id', 'ID de almacén'], ['physical_base', 'Unidades base'], ['expiry', 'Vencimiento impreso']] },
};

@Component({
  selector: 'botica-admin-records',
  imports: [RouterLink],
  template: `
    <section class="page-intro">
      <h1>{{ view?.title ?? 'Reportes' }}</h1>
      @if (resource === 'almacenes') { <p>Consulta los almacenes registrados y el código de sede que los identifica.</p> }
    </section>
    @if (resource === 'trabajadores' && !canCreate()) {
      <p class="notice" role="status">Solo los administradores pueden consultar el directorio de personal.</p>
    } @else if (view; as table) {
      @if ((resource === 'proveedores' || resource === 'almacenes') && canCreate()) {
        <details class="card demo-editor"><summary>{{ resource === 'almacenes' ? 'Registrar almacén' : 'Registrar proveedor' }}</summary>
          <form #entry [class.warehouse-entry]="resource === 'almacenes'" (submit)="saveRecord($event, entry)">
            @if (resource === 'almacenes') {
              <div class="warehouse-field">
                <div class="warehouse-label">
                  <label for="warehouse-code">Código de sede</label>
                  <span class="warehouse-help" (mouseenter)="showWarehouseHelp.set(true)" (mouseleave)="showWarehouseHelp.set(false)">
                    <button type="button" aria-label="Ayuda sobre el código de sede" aria-describedby="warehouse-code-help"
                      (focus)="showWarehouseHelp.set(true)" (click)="showWarehouseHelp.set(true)" (blur)="showWarehouseHelp.set(false)"
                      (keydown.escape)="showWarehouseHelp.set(false)">!</button>
                    <span id="warehouse-code-help" role="tooltip" [hidden]="!showWarehouseHelp()">Ingresa el código interno que identificará al almacén de esa sede.</span>
                  </span>
                </div>
                <input id="warehouse-code" name="code" maxlength="60" required aria-describedby="warehouse-code-help">
              </div>
              <label>Nombre del almacén<input name="name" maxlength="200" required></label>
            } @else {
              <label>Nombre<input name="name" maxlength="200" required></label>
              <label>Documento<input name="document_number" maxlength="40"></label>
            }
            <button type="submit" class="primary-button" [disabled]="saving()">{{ saving() ? 'Guardando…' : resource === 'almacenes' ? 'Guardar almacén' : 'Registrar proveedor' }}</button>
          </form>
        </details>
        <p role="status">{{ feedback() }}</p>
      }
      @if (supplierLoading()) { <div class="skeleton" role="status" aria-label="Cargando proveedor"></div> }
      @if (supplierError()) { <p class="notice" role="alert">{{ supplierError() }}</p> }
      @if (supplierDetail(); as selected) {
        <section class="card section-panel">
          <h2>{{ selected.name }}</h2>
          <p>{{ selected.document_number || 'Sin documento' }} · {{ selected.active ? 'Activo' : 'Inactivo' }}</p>
          @if (canCreate()) {
            <form class="module-filters" #supplierEdit (submit)="updateSupplier($event, supplierEdit, selected)">
              <label>Nombre<input name="name" [value]="selected.name" maxlength="200" required></label>
              <label>Documento<input name="document_number" [value]="selected.document_number ?? ''" maxlength="40"></label>
              <label><input type="checkbox" name="active" [checked]="selected.active"> Activo</label>
              <button type="submit" class="primary-button" [disabled]="saving()">Guardar cambios</button>
            </form>
          }
          <button type="button" (click)="supplierDetail.set(null)">Cerrar detalle</button>
        </section>
      }
      <section class="card section-panel" [attr.aria-busy]="loading()">
        @if (table.search || resource === 'vencimientos') {
        <form class="module-filters" #filters (submit)="apply($event, filters)">
          @if (table.search) { <label>Buscar<input type="search" name="q" [maxLength]="resource === 'trabajadores' ? 120 : 200"></label> }
          @if (resource === 'trabajadores') {
            <label>Estado<select name="status"><option value="">Todos</option><option value="active">Activo</option><option value="blocked">Bloqueado</option></select></label>
          }
          @if (resource === 'vencimientos') {
            <label>Desde<input type="date" name="as_of" required></label>
            <label>Hasta<input type="date" name="expires_through" required></label>
          }
          <button type="submit">{{ resource === 'vencimientos' ? 'Consultar vencimientos' : 'Buscar' }}</button>
          @if (table.search) { <button type="button" (click)="filters.reset(); apply($event, filters)">Limpiar filtros</button> }
        </form>
        }
        @if (loading()) { <div class="skeleton" role="status" aria-label="Cargando registros"></div> }
        @else if (error()) { <p class="notice" role="alert">{{ error() }} <button type="button" (click)="load(cursor())">Reintentar</button></p> }
        @else if (!requested()) { <p>Selecciona un intervalo para consultar los vencimientos.</p> }
        @else if (!rows().length) { <p class="record-detail" role="status">No se encontraron registros.</p> }
        @else {
          <div class="table-scroll"><table><thead><tr>
            @for (column of table.columns; track column[0]) { <th scope="col">{{ column[1] }}</th> }
            @if (resource === 'proveedores') { <th scope="col">Detalle</th> }
          </tr></thead><tbody>
            @for (row of rows(); track row.id ?? $index) {
              <tr>@for (column of table.columns; track column[0]) { <td>{{ cell(row, column[0]) }}</td> }
                @if (resource === 'proveedores') { <td>@if (row.id) { <button type="button" [disabled]="supplierLoading() || saving()" (click)="openSupplier(row.id)">Ver proveedor</button> }</td> }
              </tr>
            }
          </tbody></table></div>
          <div class="pagination">
            <button type="button" [disabled]="history().length === 0" (click)="previous()">Anterior</button>
            <span>Página {{ history().length + 1 }}</span>
            <button type="button" [disabled]="next() === null" (click)="advance()">Siguiente</button>
          </div>
        }
      </section>
    } @else {
      <section class="card section-panel"><h2>Reportes de inventario</h2>
        <nav class="quick-links" aria-label="Reportes disponibles">
          <a routerLink="/kardex">Kardex</a><a routerLink="/trazabilidad">Trazabilidad</a>
          <a routerLink="/vencimientos">Vencimientos</a><a routerLink="/cuarentena">Cuarentena</a>
        </nav>
      </section>
    }
  `,
  styles: `
    .demo-editor .warehouse-entry { width: min(100%, max(50%, 20rem)); grid-template-columns: minmax(0, 1fr); }
    .warehouse-entry .primary-button { justify-self: start; }
    .warehouse-field { display: grid; gap: .25rem; }
    .warehouse-label { display: flex; align-items: center; gap: .45rem; }
    .warehouse-help { position: relative; display: inline-flex; }
    .warehouse-help button { display: grid; place-items: center; width: 1.5rem; height: 1.5rem; padding: 0; border: 1px solid currentColor; border-radius: 50%; background: var(--mint); color: var(--brand); font-size: .875rem; font-weight: 750; }
    .warehouse-help [role="tooltip"] { position: absolute; z-index: 2; inset-inline-end: 0; bottom: 100%; width: max-content; max-width: min(15rem, 45vw); padding: .5rem .65rem; border-radius: .5rem; background: var(--sidebar); color: white; font-size: .875rem; }
  `,
})
export class RecordsPage {
  private readonly api = inject(AdminApi);
  private readonly session = inject(AuthSession);
  private readonly route = inject(ActivatedRoute);
  protected readonly resource: string = this.route.snapshot.data['resource'];
  protected readonly view = views[this.resource];
  protected readonly canCreate = computed(() => this.session.user()?.roles.includes('administrator') === true);
  protected readonly rows = signal<RecordRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly feedback = signal('');
  protected readonly saving = signal(false);
  protected readonly showWarehouseHelp = signal(false);
  protected readonly supplierDetail = signal<SupplierDetail|null>(null);
  protected readonly supplierError = signal('');
  protected readonly supplierLoading = signal(false);
  protected readonly requested = signal(false);
  protected readonly history = signal<(string | null)[]>([]);
  protected readonly cursor = signal<string | null>(null);
  protected readonly next = signal<string | null>(null);
  private criteria = new URLSearchParams();
  private readonly requests = new Subject<string>();

  constructor() {
    const product = this.route.snapshot.queryParamMap.get('product_id');
    if (this.resource === 'presentaciones' && product && product.length <= 200) this.criteria.set('product_id', product);
    this.requests.pipe(
      switchMap(path => this.api.read<CursorPage<RecordRow>>(path).pipe(
        tap(page => {
          if (!Array.isArray(page.data) || (page.next_cursor !== null && typeof page.next_cursor !== 'string')) {
            throw new Error('La respuesta de la consulta no tiene el formato esperado.');
          }
          this.rows.set(page.data);
          this.next.set(page.next_cursor);
          this.loading.set(false);
        }),
        catchError((error: Error) => {
          this.error.set(error.message);
          this.loading.set(false);
          return EMPTY;
        }),
      )),
      takeUntilDestroyed(),
    ).subscribe();
    if (this.view && this.resource !== 'vencimientos' && (this.resource !== 'trabajadores' || this.canCreate())) this.load(null);
  }

  protected load(cursor: string | null): void {
    if (!this.view) return;
    this.cursor.set(cursor);
    this.requested.set(true);
    this.loading.set(true);
    this.error.set('');
    const params = new URLSearchParams(this.criteria);
    params.set('limit', String(ADMIN_PAGE_SIZE));
    if (cursor) params.set('after', cursor);
    this.requests.next(this.view.path + '?' + params.toString());
  }

  protected apply(event: Event, form: HTMLFormElement): void {
    event.preventDefault();
    const fields = new FormData(form);
    const params = new URLSearchParams();
    const product = this.criteria.get('product_id');
    if (product) params.set('product_id', product);
    for (const [key, value] of fields) if (String(value).trim()) params.set(key, String(value).trim());
    if (this.resource === 'vencimientos' && (params.get('as_of') ?? '') > (params.get('expires_through') ?? '')) {
      this.error.set('La fecha final debe ser igual o posterior a la inicial.');
      return;
    }
    this.criteria = params;
    this.history.set([]);
    this.load(null);
  }

  protected advance(): void {
    const cursor = this.next();
    if (!cursor) return;
    this.history.update(history => [...history, this.cursor()]);
    this.load(cursor);
  }

  protected previous(): void {
    const history = this.history();
    if (!history.length) return;
    this.history.set(history.slice(0, -1));
    this.load(history.at(-1) ?? null);
  }

  protected cell(row: RecordRow, key: ColumnKey): string | number {
    if (key === 'roles') {
      const roles: unknown = row.roles;
      return Array.isArray(roles) ? roles.map(role => role === 'administrator' ? 'Administrador' : role === 'pharmacist' ? 'Farmacéutico' : String(role)).join(', ') : '—';
    }
    if (key === 'status') return row.status === 'active' ? 'Activo' : row.status === 'blocked' ? 'Bloqueado' : row.status ?? '—';
    if (key === 'active') return row.active === true ? 'Activo' : row.active === false ? 'Inactivo' : '—';
    if (key !== 'expiry') return row[key] ?? '—';
    return row.expiry_precision ? printedExpiry({
      expiry_precision: row.expiry_precision, expiry_year: row.expiry_year ?? null,
      expiry_month: row.expiry_month ?? null, expiry_day: row.expiry_day ?? null,
    }) : '—';
  }

  protected async openSupplier(id: string): Promise<void> {
    this.supplierLoading.set(true);
    this.supplierError.set('');
    this.supplierDetail.set(null);
    try {
      const { data } = await this.api.get<{data: SupplierDetail}>('inventory/suppliers/' + encodeURIComponent(id));
      if (data?.id !== id || typeof data.active !== 'boolean' || !/^[1-9]\d*$/.test(data.version)) throw new Error('El detalle del proveedor no tiene el formato esperado.');
      this.supplierDetail.set(data);
    } catch (error) {
      this.supplierError.set((error as Error).message);
    } finally {
      this.supplierLoading.set(false);
    }
  }

  protected async updateSupplier(event: Event, form: HTMLFormElement, current: SupplierDetail): Promise<void> {
    event.preventDefault();
    if (!this.canCreate() || this.saving() || !form.reportValidity()) return;
    const values = new FormData(form);
    const name = String(values.get('name') ?? '').trim();
    const document_number = String(values.get('document_number') ?? '').trim() || null;
    const active = values.has('active');
    this.supplierError.set('');
    this.feedback.set('');
    if (!name) { this.supplierError.set('Completa el nombre del proveedor.'); return; }
    if (name === current.name && document_number === current.document_number && active === current.active) {
      this.feedback.set('No hay cambios para guardar.');
      return;
    }
    this.saving.set(true);
    try {
      const { data } = await this.api.patch<{data: SupplierDetail}>('inventory/suppliers/' + encodeURIComponent(current.id), {
        name, document_number, active, expected_version: current.version,
      });
      this.supplierDetail.set(data);
      this.feedback.set('Proveedor actualizado.');
      this.load(this.cursor());
    } catch (error) {
      this.supplierError.set((error as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  protected async saveRecord(event: Event, form: HTMLFormElement): Promise<void> {
    event.preventDefault();
    if (!this.canCreate() || this.saving() || !form.reportValidity()) return;
    const data = new FormData(form);
    const warehouse = this.resource === 'almacenes';
    const name = String(data.get('name') ?? '').trim();
    const document = String(data.get('document_number') ?? '').trim();
    const code = String(data.get('code') ?? '').trim();
    if (!name || (warehouse && !code)) {
      this.feedback.set(warehouse ? 'Completa el código de sede y el nombre del almacén.' : 'Completa el nombre del proveedor.');
      return;
    }
    this.saving.set(true);
    try {
      if (warehouse) await this.api.post('inventory/warehouses', { name, code });
      else await this.api.post('inventory/suppliers', { name, ...(document ? { document_number: document } : {}) });
      form.reset();
      this.feedback.set(warehouse ? 'Almacén registrado.' : 'Proveedor registrado.');
      this.history.set([]);
      this.load(null);
    } catch (error) {
      this.feedback.set((error as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
