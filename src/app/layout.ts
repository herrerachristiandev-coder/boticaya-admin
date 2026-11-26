import { Component, DestroyRef, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthSession } from './auth-session';
import { AdminApi } from './admin-api';
import { CatalogStore } from './catalog-store';
import { InventoryStore } from './inventory-store';

const inactivityMs = 12 * 60 * 1000;
const responseMs = 15 * 1000;

@Component({
  selector: 'botica-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  providers: [AdminApi, CatalogStore, InventoryStore],
  host: {
    '(document:keydown)': 'registerActivity()',
    '(document:pointerdown)': 'registerActivity()',
    '(document:wheel)': 'registerActivity()',
    '(document:visibilitychange)': 'checkDeadline()',
  },
  template: `
    <a class="skip-link" href="#admin-content">Saltar al contenido</a>
    <div class="shell" [class.sidebar-collapsed]="collapsed()">
      <aside class="sidebar" id="admin-menu" [class.is-open]="menuOpen()">
        <a routerLink="/dashboard" class="brand" (click)="menuOpen.set(false)" aria-label="Botica Ya, inicio">
          <span class="brand-mark" aria-hidden="true">+</span><span>Botica Ya<small>Administración</small></span>
        </a>
        <nav aria-label="Menú administrativo">
          @for (group of groups; track group.title) {
            <p class="nav-label">{{ group.title }}</p>
            @for (module of group.links; track module.path) {
              <a [routerLink]="module.path" routerLinkActive="active" ariaCurrentWhenActive="page" [title]="module.label" (click)="menuOpen.set(false)">
                <span aria-hidden="true">{{ module.icon }}</span><span class="nav-text">{{ module.label }}</span>
              </a>
            }
          }
        </nav>
        <div class="sidebar-footer"><span class="initials" aria-hidden="true">BY</span><span class="nav-text">{{ session.user()?.fullName }}<small>Equipo Botica Ya</small></span></div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <div class="topbar-group">
            <button type="button" class="menu-toggle" aria-controls="admin-menu" [attr.aria-expanded]="menuOpen()" (click)="menuOpen.set(!menuOpen())">Menú</button>
            <button type="button" class="desktop-toggle" aria-controls="admin-menu" [attr.aria-expanded]="!collapsed()" (click)="collapsed.set(!collapsed())">{{ collapsed() ? 'Expandir menú' : 'Contraer menú' }}</button>
            <span class="breadcrumbs">Administración</span>
          </div>
          <div class="topbar-group">
            <button type="button" class="text-link logout-button" [disabled]="closing()" (click)="logout()">{{ closing() ? 'Cerrando…' : 'Cerrar sesión' }}</button>
          </div>
        </header>
        <main id="admin-content" tabindex="-1" class="content">
          @if (session.error()) { <p class="form-error" role="alert">{{ session.error() }}</p> }
          <router-outlet />
        </main>
      </div>
    </div>
    <dialog #idleDialog class="idle-dialog" aria-labelledby="idle-title" aria-describedby="idle-description" (cancel)="$event.preventDefault()">
      <h2 id="idle-title">¿Sigues ahí?</h2>
      <p id="idle-description">Confirma para seguir conectado. La sesión se cerrará si no respondes.</p>
      <p>Tiempo restante: <strong>{{ remaining() }} s</strong></p>
      <div class="pagination">
        <button type="button" class="primary-button" autofocus [disabled]="checking() || closing()" (click)="stayConnected()">{{ checking() ? 'Verificando…' : 'Sí, seguir conectado' }}</button>
        <button type="button" [disabled]="closing()" (click)="closeForInactivity()">Cerrar sesión</button>
      </div>
    </dialog>
  `,
})
export class AdminLayout {
  protected readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  protected readonly closing = signal(false);
  protected readonly checking = signal(false);
  protected readonly remaining = signal(0);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('idleDialog');
  private readonly warning = signal(false);
  private idleDeadline = Date.now() + inactivityMs;
  private warningDeadline = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.schedule(inactivityMs);
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) return;
      if (this.warning() && !dialog.open) dialog.showModal();
      if (!this.warning() && dialog.open) dialog.close();
    });
  }

  protected registerActivity(): void {
    if (this.warning() || this.closing()) return;
    const now = Date.now();
    if (now >= this.idleDeadline) { this.checkDeadline(); return; }
    this.idleDeadline = now + inactivityMs;
  }

  protected checkDeadline(): void {
    if (!this.session.user() || this.closing() || this.checking()) return;
    const now = Date.now();
    if (!this.warning()) {
      if (now < this.idleDeadline) {
        this.schedule(this.idleDeadline - now);
        return;
      }
      this.warningDeadline = this.idleDeadline + responseMs;
      this.warning.set(true);
    }
    if (now >= this.warningDeadline) {
      void this.closeForInactivity();
      return;
    }
    const remaining = this.warningDeadline - now;
    this.remaining.set(Math.ceil(remaining / 1000));
    this.schedule(remaining % 1000 || 1000);
  }

  private schedule(delay: number): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.checkDeadline(), delay);
  }

  protected async stayConnected(): Promise<void> {
    if (this.checking() || this.closing()) return;
    if (Date.now() >= this.warningDeadline) { await this.closeForInactivity(); return; }
    this.checking.set(true);
    clearTimeout(this.timer);
    try {
      if (!await this.session.restore() || this.closing()) {
        if (!this.closing()) await this.closeForInactivity();
        return;
      }
      this.warning.set(false);
      this.idleDeadline = Date.now() + inactivityMs;
      this.schedule(inactivityMs);
    } finally {
      this.checking.set(false);
    }
  }

  protected async closeForInactivity(): Promise<void> {
    if (this.closing()) return;
    this.closing.set(true);
    clearTimeout(this.timer);
    this.session.lock();
    try { await this.session.logout(); }
    catch { }
    finally { await this.router.navigateByUrl('/login'); }
  }
  async logout(): Promise<void> {
    if (this.closing()) return;
    this.closing.set(true);
    try { await this.session.logout(); await this.router.navigateByUrl('/login'); }
    catch { }
    finally { this.closing.set(false); }
  }
  protected readonly menuOpen = signal(false);
  protected readonly collapsed = signal(false);
  protected readonly groups = [
    { title: 'Operación', links: [
      { label: 'Inicio', icon: '▦', path: '/dashboard' },
      { label: 'Inventario', icon: '▤', path: '/inventario' },
      { label: 'Recepciones', icon: '↓', path: '/inventario/recepciones' },
      { label: 'Movimientos', icon: '↔', path: '/inventario/movimientos' },
      { label: 'Reportes', icon: '▥', path: '/reportes' },
    ] },
    { title: 'Catálogo', links: [
      { label: 'Productos', icon: '◇', path: '/productos' },
      { label: 'Categorías', icon: '▦', path: '/categorias' },
      { label: 'Marcas', icon: '◈', path: '/marcas' },
      { label: 'Presentaciones', icon: '▣', path: '/presentaciones' },
      { label: 'Proveedores', icon: '♧', path: '/proveedores' },
      { label: 'Almacenes', icon: '▤', path: '/almacenes' },
    ] },
    { title: 'Administración', links: [
      { label: 'Trabajadores', icon: '♙', path: '/trabajadores' },
      { label: 'Configuración', icon: '⚙', path: '/configuracion' },
    ] },
  ];
}
