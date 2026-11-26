import { Component } from '@angular/core';

@Component({
  selector: 'botica-admin-orders',
  template: `
    <section class="page-intro"><h1>Pedidos</h1><p>Seguimiento de pedidos de la botica.</p></section>
    <p class="notice" role="status">La consulta de pedidos está pendiente de conexión con la sesión administrativa.</p>
  `,
})
export class OrdersPage {}
