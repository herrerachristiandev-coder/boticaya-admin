import { Component, computed, inject, signal } from '@angular/core';
import { DASHBOARD_SNAPSHOT, ORDER_STATUS_LABELS, orderCurrency } from './dashboard-data';

@Component({
  selector: 'botica-admin-orders',
  template: `
    <section class="page-intro"><h1>Pedidos</h1><p>Consulta los pedidos y su estado de atención.</p>
      <div class="demo-notice"><strong>Datos de demostración.</strong> Los pedidos y los importes son ficticios.</div>
    </section>
    <section class="card" aria-label="Listado de pedidos">
      <div class="module-filters">
        <label>Código<input #search type="search" (input)="query.set(search.value)"></label>
        <label>Estado<select #status (change)="statusFilter.set(status.value)">
          <option value="">Todos</option>
          @for (entry of statuses; track entry[0]) { <option [value]="entry[0]">{{ entry[1] }}</option> }
        </select></label>
      </div>
      <table><thead><tr><th scope="col">Pedido</th><th scope="col">Total</th><th scope="col">Estado</th></tr></thead>
        <tbody>
          @for (order of visibleOrders(); track order.id) {
            <tr><th scope="row">{{ order.id }}<small>{{ order.channel }} · {{ order.time }}</small></th>
              <td>{{ currency.format(order.amount) }}</td><td><span class="pill" [class]="order.status">{{ labels[order.status] }}</span></td></tr>
          } @empty { <tr><td colspan="3">No hay pedidos con estos filtros.</td></tr> }
        </tbody>
      </table>
    </section>
  `,
})
export class OrdersPage {
  protected readonly labels = ORDER_STATUS_LABELS;
  protected readonly statuses = Object.entries(this.labels);
  protected readonly currency = orderCurrency;
  protected readonly query = signal('');
  protected readonly statusFilter = signal('');
  private readonly orders = inject(DASHBOARD_SNAPSHOT).orders;
  protected readonly visibleOrders = computed(() => {
    const query = this.query().trim().toUpperCase();
    const status = this.statusFilter();
    return this.orders.filter(order => order.id.includes(query) && (!status || order.status === status));
  });
}
