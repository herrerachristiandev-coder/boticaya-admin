import { Component } from '@angular/core';
import { RouterOutlet, Routes } from '@angular/router';
import { AdminLayout } from './layout';
import { LoginPage } from './login';
import { DashboardPage } from './dashboard';
import { InventoryPage } from './inventory';
import { WorkersPage } from './workers';
import { ProductsPage } from './products';
import { OrdersPage } from './orders';
import { ReportsPage } from './reports';
import { SettingsPage } from './settings';

@Component({
  selector: 'botica-admin',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class AdminApp {}

export const adminRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginPage, title: 'Acceso administrativo | Botica Ya' },
  {
    path: '',
    component: AdminLayout,
    children: [
      { path: 'dashboard', component: DashboardPage, title: 'Inicio | Botica Ya' },
      { path: 'inventario', component: InventoryPage, title: 'Inventario | Botica Ya' },
      { path: 'trabajadores', component: WorkersPage, title: 'Trabajadores | Botica Ya' },
      { path: 'productos', component: ProductsPage, title: 'Productos | Botica Ya' },
      { path: 'pedidos', component: OrdersPage, title: 'Pedidos | Botica Ya' },
      { path: 'reportes', component: ReportsPage, title: 'Reportes | Botica Ya' },
      { path: 'configuracion', component: SettingsPage, title: 'Configuración | Botica Ya' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
