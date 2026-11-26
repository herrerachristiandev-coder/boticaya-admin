import { Routes } from '@angular/router';
import { adminGuard } from './auth-guard';

export const adminRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'admin', pathMatch: 'full', redirectTo: 'inventario' },
      { path: 'login', loadComponent: () => import('./login').then(m => m.LoginPage), title: 'Acceso administrativo | Botica Ya' },
  {
    path: '', loadComponent: () => import('./layout').then(m => m.AdminLayout), canActivateChild: [adminGuard],
    children: [
      { path: 'dashboard', loadComponent: () => import('./dashboard').then(m => m.DashboardPage), title: 'Inicio | Botica Ya' },
      { path: 'productos', loadComponent: () => import('./products').then(m => m.ProductsPage), title: 'Productos | Botica Ya' },
      { path: 'productos/:id', loadComponent: () => import('./product-detail').then(m => m.ProductDetailPage), title: 'Ficha de producto | Botica Ya' },
      { path: 'trabajadores', loadComponent: () => import('./records').then(m => m.RecordsPage), data: { resource: 'trabajadores' }, title: 'Trabajadores | Botica Ya' },
      { path: 'pedidos', loadComponent: () => import('./orders').then(m => m.OrdersPage), title: 'Pedidos | Botica Ya' },
      { path: 'configuracion', loadComponent: () => import('./settings').then(m => m.SettingsPage), title: 'Configuración | Botica Ya' },
      { path: 'inventario', loadComponent: () => import('./inventory').then(m => m.InventoryPage), data: { inventoryView: 'all' }, title: 'Inventario | Botica Ya' },
      { path: 'inventario/stock', loadComponent: () => import('./inventory').then(m => m.InventoryPage), data: { inventoryView: 'stock' }, title: 'Stock | Botica Ya' },
      { path: 'inventario/recepciones', loadComponent: () => import('./inventory').then(m => m.InventoryPage), data: { inventoryView: 'receipts' }, title: 'Recepciones | Botica Ya' },
      { path: 'inventario/lotes', loadComponent: () => import('./inventory').then(m => m.InventoryPage), data: { inventoryView: 'lots' }, title: 'Lotes | Botica Ya' },
      { path: 'inventario/movimientos', loadComponent: () => import('./inventory').then(m => m.InventoryPage), data: { inventoryView: 'movements' }, title: 'Movimientos | Botica Ya' },
      { path: 'categorias', loadComponent: () => import('./records').then(m => m.RecordsPage), data: { resource: 'categorias' }, title: 'Categorias | Botica Ya' },
      { path: 'marcas', loadComponent: () => import('./records').then(m => m.RecordsPage), data: { resource: 'marcas' }, title: 'Marcas | Botica Ya' },
      { path: 'presentaciones', loadComponent: () => import('./records').then(m => m.RecordsPage), data: { resource: 'presentaciones' }, title: 'Presentaciones | Botica Ya' },
      { path: 'proveedores', loadComponent: () => import('./records').then(m => m.RecordsPage), data: { resource: 'proveedores' }, title: 'Proveedores | Botica Ya' },
      { path: 'almacenes', loadComponent: () => import('./records').then(m => m.RecordsPage), data: { resource: 'almacenes' }, title: 'Almacenes | Botica Ya' },
      { path: 'vencimientos', loadComponent: () => import('./records').then(m => m.RecordsPage), data: { resource: 'vencimientos' }, title: 'Vencimientos | Botica Ya' },
      { path: 'kardex', loadComponent: () => import('./records').then(m => m.RecordsPage), data: { resource: 'kardex' }, title: 'Kardex | Botica Ya' },
      { path: 'trazabilidad', loadComponent: () => import('./records').then(m => m.RecordsPage), data: { resource: 'trazabilidad' }, title: 'Trazabilidad | Botica Ya' },
      { path: 'cuarentena', loadComponent: () => import('./records').then(m => m.RecordsPage), data: { resource: 'cuarentena' }, title: 'Cuarentena | Botica Ya' },
      { path: 'reportes', loadComponent: () => import('./records').then(m => m.RecordsPage), data: { resource: 'reportes' }, title: 'Reportes | Botica Ya' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
