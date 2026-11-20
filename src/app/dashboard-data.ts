import { InjectionToken } from '@angular/core';

export type OrderStatus = 'completed' | 'preparing' | 'pending';

export const ORDER_STATUS_LABELS = {
  pending: 'Pendiente',
  preparing: 'En preparación',
  completed: 'Entregado',
} satisfies Record<OrderStatus, string>;

export const orderCurrency = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

export interface DashboardSnapshot {
  readonly metrics: readonly { label: string; value: string; detail: string; icon: string }[];
  readonly orders: readonly { id: string; time: string; channel: string; amount: number; status: OrderStatus }[];
  readonly alerts: readonly { title: string; detail: string; action: string; severity: 'warning' | 'danger' }[];
}

export const dashboardDemo: DashboardSnapshot = {
  metrics: [
    { label: 'Pedidos de hoy', value: '24', detail: '4 pendientes de atención', icon: '▣' },
    { label: 'Ventas de hoy', value: 'S/ 1 286,50', detail: 'Importe de pedidos entregados', icon: '↗' },
    { label: 'Productos activos', value: '186', detail: 'Referencias en el catálogo', icon: '◇' },
    { label: 'Alertas de inventario', value: '7', detail: '5 de stock y 2 de vencimiento', icon: '!' },
  ],
  orders: [
    { id: 'BY-0124', time: '11:42', channel: 'Tienda web', amount: 78.5, status: 'pending' },
    { id: 'BY-0123', time: '11:18', channel: 'Tienda web', amount: 42.9, status: 'preparing' },
    { id: 'BY-0122', time: '10:56', channel: 'Tienda web', amount: 125, status: 'completed' },
    { id: 'BY-0121', time: '10:21', channel: 'Tienda web', amount: 34.8, status: 'completed' },
  ],
  alerts: [
    { title: 'Stock bajo', detail: 'Alcohol en gel 500 ml · 3 unidades', action: 'Revisar reposición', severity: 'danger' },
    { title: 'Vencimiento próximo', detail: 'Solución salina · lote DEM-014', action: 'Vence en 18 días', severity: 'warning' },
    { title: 'Stock bajo', detail: 'Gasa estéril · 5 unidades', action: 'Revisar reposición', severity: 'warning' },
  ],
};

export const DASHBOARD_SNAPSHOT = new InjectionToken<DashboardSnapshot>('Dashboard snapshot', {
  factory: () => dashboardDemo,
});
