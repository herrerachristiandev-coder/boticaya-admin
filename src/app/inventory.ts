import { Component, computed, inject, signal } from '@angular/core';

import { DemoInventory } from './inventory-data';

@Component({
  selector: 'botica-admin-inventory',
  template: `
    <section class="page-intro">
      <h1>Inventario</h1>
      <p>Consulta existencias, lotes y movimientos por producto.</p>
      <div class="demo-notice"><strong>Datos de demostración.</strong> Fecha de referencia: 19/11/2026.</div>
    </section>
    <details class="card demo-editor">
      <summary>Registrar entrada</summary>
      <form #editor (submit)="receive($event, editor)">
        <label>Producto<select name="sku" required>
          <option value="">Selecciona un producto</option>
          @for (product of products(); track product.sku) { <option [value]="product.sku">{{ product.name }} · {{ product.sku }}</option> }
        </select></label>
        <label>Código de lote<input name="lot" required maxlength="40"></label>
        <label>Vencimiento<input name="expiry" type="date" required min="2026-11-20"></label>
        <label>Cantidad recibida<input name="quantity" type="number" required min="1" step="1"></label>
        <button type="submit" class="primary-button">Guardar entrada de muestra</button>
      </form>
    </details>
    <p class="demo-feedback" role="status">{{ feedback() }}</p>
    <section class="card module-alerts" aria-labelledby="inventory-alerts">
      <h2 id="inventory-alerts">Alertas de inventario</h2>
      <ul>
        @for (product of flaggedProducts(); track product.sku) {
          <li>{{ product.name }} · {{ product.state }}
            @for (lot of product.lots; track lot.code) {
              @if (lot.expiryState !== 'Vigente') { <span> · Lote {{ lot.code }} ({{ lot.expiryState }})</span> }
            }
          </li>
        }
      </ul>
    </section>
    <section class="card module-card" aria-label="Productos en inventario">
      <div class="module-filters">
        <label>Producto o SKU<input #queryInput type="search" [value]="query()" (input)="query.set(queryInput.value)"></label>
        <label>Stock<select #stockInput [value]="stockFilter()" (change)="stockFilter.set(stockInput.value)">
          <option value="">Todos</option><option>Stock bajo</option><option>Agotado</option><option>Disponible</option>
        </select></label>
        <label>Vencimiento<select #expiryInput [value]="expiryFilter()" (change)="expiryFilter.set(expiryInput.value)">
          <option value="">Todos</option><option>Vence pronto</option><option>Vencido</option><option>Vigente</option>
        </select></label>
        <button type="button" (click)="query.set(''); stockFilter.set(''); expiryFilter.set('')">Limpiar filtros</button>
      </div>
      <div class="record-list">
        @for (product of visibleProducts(); track product.sku) {
          <details>
            <summary>
              <span><strong>{{ product.name }}</strong><small>{{ product.sku }}</small></span>
              <span>{{ product.stock }} unidades <small>{{ product.state }}</small></span>
            </summary>
            <div class="record-detail">
              @if (product.lots.length) {
              <label>Movimientos<select #movement (change)="setMovement(product.sku, movement.value)" [value]="movementSelections()[product.sku] ?? ''">
                <option value="">Todos</option><option value="entry">Entradas</option><option value="exit">Salidas</option>
              </select></label>
              }
              @for (lot of product.lots; track lot.code) {
              <h2>Lote {{ lot.code }}</h2>
              <p>Vencimiento {{ lot.expiry }} · {{ lot.expiryState }} · {{ lot.stock }} unidades</p>
              <table>
                <thead><tr><th scope="col">Fecha</th><th scope="col">Tipo</th><th scope="col">Cantidad</th><th scope="col">Motivo</th></tr></thead>
                <tbody>
                  @for (movement of lot.movements; track $index) {
                    @if (!movementSelections()[product.sku] || movementSelections()[product.sku] === movement.type) {
                      <tr><td>{{ movement.date }}</td><td>{{ movement.type === 'entry' ? 'Entrada' : 'Salida' }}</td><td>{{ movement.quantity }}</td><td>{{ movement.reason }}</td></tr>
                    }
                  }
                </tbody>
              </table>
              } @empty { <p>Este producto todavía no tiene lotes.</p> }
            </div>
          </details>
        } @empty {
          <p class="record-detail" role="status">No hay productos con estos filtros.</p>
        }
      </div>
    </section>
  `,
})
export class InventoryPage {
  private readonly inventory = inject(DemoInventory);
  protected readonly products = this.inventory.products;
  protected readonly feedback = signal('');
  protected readonly flaggedProducts = computed(() => this.products().filter(product =>
    product.state !== 'Disponible' || product.lots.some(lot => lot.expiryState !== 'Vigente'),
  ));
  protected readonly movementSelections = signal<Partial<Record<string, string>>>({});
  protected readonly query = signal('');
  protected readonly stockFilter = signal('');
  protected readonly expiryFilter = signal('');
  protected readonly visibleProducts = computed(() => {
    const search = this.query().trim().toLowerCase();
    return this.products().filter(product =>
      (product.name.toLowerCase().includes(search) || product.sku.toLowerCase().includes(search)) &&
      (!this.stockFilter() || product.state === this.stockFilter()) &&
      (!this.expiryFilter() || product.lots.some(lot => lot.expiryState === this.expiryFilter())),
    );
  });

  protected setMovement(sku: string, selection: string): void {
    this.movementSelections.update(current => ({ ...current, [sku]: selection }));
  }

  protected receive(event: Event, form: HTMLFormElement): void {
    event.preventDefault();
    const fields = new FormData(form);
    const error = this.inventory.receive(
      String(fields.get('sku') ?? ''), String(fields.get('lot') ?? ''),
      String(fields.get('expiry') ?? ''), Number(fields.get('quantity')),
    );
    this.feedback.set(error || 'Entrada registrada en la demo. El stock se actualizó.');
    if (!error) form.reset();
  }
}
