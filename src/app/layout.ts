import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'botica-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <a class="skip-link" href="#admin-content">Saltar al contenido</a>
    <div class="shell">
      <aside class="sidebar" id="admin-menu" [class.is-open]="menuOpen()">
        <a routerLink="/dashboard" class="brand" (click)="menuOpen.set(false)" aria-label="Botica Ya, inicio">
          <span class="brand-mark" aria-hidden="true">+</span><span>Botica Ya<small>Administración</small></span>
        </a>
        <nav aria-label="Menú administrativo">
          <p class="nav-label">GENERAL</p>
          @for (module of activeModules; track module.path) {
            <a [routerLink]="module.path" routerLinkActive="active" ariaCurrentWhenActive="page" (click)="menuOpen.set(false)">
              <span aria-hidden="true">{{ module.icon }}</span>{{ module.label }}
            </a>
          }
        </nav>
        <div class="sidebar-footer"><span class="initials" aria-hidden="true">BY</span><span>Equipo Botica Ya<small>Vista de demostración</small></span></div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <div class="topbar-group">
            <button type="button" class="menu-toggle" aria-controls="admin-menu" [attr.aria-expanded]="menuOpen()" (click)="menuOpen.set(!menuOpen())">Menú</button>
            <span class="breadcrumbs">Administración</span>
          </div>
          <div class="topbar-group">
            <span class="demo-label">Demostración</span>
            <a class="text-link" routerLink="/login">Volver al acceso</a>
          </div>
        </header>
        <main id="admin-content" tabindex="-1" class="content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class AdminLayout {
  protected readonly menuOpen = signal(false);
  protected readonly activeModules = [
    { label: 'Inicio', icon: '▦', path: '/dashboard' },
    { label: 'Inventario', icon: '▤', path: '/inventario' },
    { label: 'Productos', icon: '◇', path: '/productos' },
    { label: 'Pedidos', icon: '▣', path: '/pedidos' },
    { label: 'Trabajadores', icon: '♙', path: '/trabajadores' },
    { label: 'Reportes', icon: '▥', path: '/reportes' },
    { label: 'Configuración', icon: '⚙', path: '/configuracion' },
  ];
}
