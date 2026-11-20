import { Component, computed, inject, signal } from '@angular/core';
import { DASHBOARD_SNAPSHOT, ORDER_STATUS_LABELS, OrderStatus, orderCurrency } from './dashboard-data';

@Component({
  selector: 'botica-admin-dashboard',
  template: `
    <section class="page-intro">
      <h1>Resumen operativo</h1>
      <p>Consulta los pedidos y las alertas de inventario desde un solo lugar.</p>
      <div class="demo-notice"><strong>Datos de demostración.</strong> Todos los indicadores, pedidos y alertas son ficticios.</div>
    </section>
    <section class="metrics" aria-label="Indicadores de operación">
      @for (metric of snapshot.metrics; track metric.label) {
        <article class="card metric">
          <div class="metric-head"><h2>{{ metric.label }}</h2><span class="metric-icon" aria-hidden="true">{{ metric.icon }}</span></div>
          <strong>{{ metric.value }}</strong>
          <p>{{ metric.detail }}</p>
        </article>
      }
    </section>
    <div class="dashboard-columns">
      <section class="card orders" aria-labelledby="orders-heading">
        <div class="section-head">
          <div><h2 id="orders-heading">Pedidos recientes</h2><p>Últimos registros de la muestra</p></div>
          <label class="filter">Estado
            <select [value]="filter()" (change)="setFilter($event)">
              <option value="all">Todos</option>
              @for (status of statuses; track status) {
                <option [value]="status">{{ statusLabels[status] }}</option>
              }
            </select>
          </label>
        </div>
        <span class="sr-only" role="status">{{ visibleOrders().length }} pedidos visibles</span>
        <table>
          <thead><tr><th scope="col">Pedido</th><th scope="col">Hora</th><th scope="col">Total</th><th scope="col">Estado</th></tr></thead>
          <tbody>
            @for (order of visibleOrders(); track order.id) {
              <tr><th scope="row">{{ order.id }}<small>{{ order.channel }}</small></th><td>{{ order.time }}</td><td>{{ currency.format(order.amount) }}</td><td><span class="pill" [class]="order.status">{{ statusLabels[order.status] }}</span></td></tr>
            }
          </tbody>
        </table>
      </section>
      <section class="card alerts" aria-labelledby="alerts-heading">
        <div class="section-head"><div><h2 id="alerts-heading">Alertas de inventario</h2><p>Prioridades de la muestra</p></div></div>
        <ul>
          @for (alert of snapshot.alerts; track alert.detail) {
            <li><span class="alert-icon" [class]="alert.severity" aria-hidden="true">!</span><div><strong>{{ alert.title }}</strong><p>{{ alert.detail }}</p><small>{{ alert.action }}</small></div></li>
          }
        </ul>
      </section>
    </div>
  `,
})
export class DashboardPage {
  protected readonly snapshot = inject(DASHBOARD_SNAPSHOT);
  protected readonly currency = orderCurrency;
  protected readonly statusLabels = ORDER_STATUS_LABELS;
  protected readonly statuses: readonly OrderStatus[] = ['pending', 'preparing', 'completed'];
  protected readonly filter = signal('all');
  protected readonly visibleOrders = computed(() => {
    const status = this.filter();
    return status === 'all' ? this.snapshot.orders : this.snapshot.orders.filter(order => order.status === status);
  });

  protected setFilter(event: Event): void {
    this.filter.set((event.target as HTMLSelectElement).value);
  }
}
