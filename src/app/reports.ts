import { Component, computed, inject } from '@angular/core';
import { DASHBOARD_SNAPSHOT, ORDER_STATUS_LABELS, orderCurrency } from './dashboard-data';
import { DemoInventory } from './inventory-data';

@Component({
  selector: 'botica-admin-reports',
  template: `
    <section class="page-intro"><h1>Reportes</h1><p>Resumen de la muestra del 19/11/2026.</p>
      <div class="demo-notice"><strong>Datos de demostración.</strong> Indicadores calculados a partir de los registros visibles en la demo.</div>
    </section>
    <section class="metrics" aria-label="Indicadores de la muestra">
      <article class="card metric"><h2>Pedidos registrados</h2><strong>{{ orders.length }}</strong></article>
      <article class="card metric"><h2>Importe entregado</h2><strong>{{ deliveredAmount }}</strong></article>
      <article class="card metric"><h2>Unidades en inventario</h2><strong>{{ totalStock() }}</strong></article>
    </section>
    <section class="card" aria-labelledby="order-report">
      <div class="section-head"><h2 id="order-report">Pedidos por estado</h2></div>
      <table><thead><tr><th scope="col">Estado</th><th scope="col">Pedidos</th></tr></thead>
        <tbody>@for (row of byStatus; track row.label) { <tr><th scope="row">{{ row.label }}</th><td>{{ row.count }}</td></tr> }</tbody>
      </table>
    </section>
  `,
})
export class ReportsPage {
  protected readonly orders = inject(DASHBOARD_SNAPSHOT).orders;
  protected readonly deliveredAmount = orderCurrency.format(this.orders.reduce(
    (total, order) => total + (order.status === 'completed' ? order.amount : 0), 0,
  ));
  private readonly inventory = inject(DemoInventory);
  protected readonly totalStock = computed(() => this.inventory.products().reduce((total, product) => total + product.stock, 0));
  protected readonly byStatus = Object.entries(ORDER_STATUS_LABELS).map(([status, label]) => ({
    label,
    count: this.orders.filter(order => order.status === status).length,
  }));
}
