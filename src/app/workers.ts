import { Component, computed, signal } from '@angular/core';

const workers = [
  { name: 'Ana Torres', email: 'ana@example.invalid', role: 'Administrador', state: 'Activo' },
  { name: 'Luis Vega', email: 'luis@example.invalid', role: 'Operador', state: 'Activo' },
  { name: 'Marta Ríos', email: 'marta@example.invalid', role: 'Operador', state: 'Inactivo' },
];
const roles = [
  { name: 'Administrador', permissions: 'Inventario: consultar y ajustar · Trabajadores: consultar y gestionar · Actividad: consultar' },
  { name: 'Operador', permissions: 'Inventario: consultar · Pedidos: consultar' },
];
const activity = [
  { time: '19/11/2026 11:42', actor: 'Ana Torres', action: 'Consultó', resource: 'Directorio de trabajadores' },
  { time: '19/11/2026 10:18', actor: 'Luis Vega', action: 'Consultó', resource: 'Lote DEM-014' },
];

@Component({
  selector: 'botica-admin-workers',
  template: `
    <section class="page-intro">
      <h1>Trabajadores</h1>
      <p>Consulta el directorio, los permisos por rol y la actividad.</p>
      <div class="demo-notice"><strong>Datos de demostración.</strong> Las personas, los permisos y los registros son ficticios.</div>
    </section>
    <section class="card module-card" aria-label="Administración de trabajadores">
      <div class="module-filters">
        <label>Vista<select #viewInput (change)="view.set(viewInput.value)">
          <option value="directory">Directorio</option><option value="roles">Roles y permisos</option><option value="activity">Actividad</option>
        </select></label>
        @if (view() === 'directory') {
          <label>Nombre<input #nameInput type="search" [value]="name()" (input)="name.set(nameInput.value)"></label>
          <label>Rol<select #roleInput [value]="role()" (change)="role.set(roleInput.value)">
            <option value="">Todos</option>@for (item of roles; track item.name) { <option>{{ item.name }}</option> }
          </select></label>
          <label>Estado<select #stateInput [value]="state()" (change)="state.set(stateInput.value)">
            <option value="">Todos</option><option>Activo</option><option>Inactivo</option>
          </select></label>
          <button type="button" (click)="name.set(''); role.set(''); state.set('')">Limpiar filtros</button>
        }
        @if (view() === 'activity') {
          <label>Actor<select #actorInput [value]="actor()" (change)="actor.set(actorInput.value)">
            <option value="">Todos</option>@for (worker of workers; track worker.email) { <option>{{ worker.name }}</option> }
          </select></label>
        }
      </div>
      <div class="record-list">
        @switch (view()) {
          @case ('directory') {
            @for (worker of visibleWorkers(); track worker.email) {
              <details><summary><strong>{{ worker.name }}</strong><span>{{ worker.state }}</span></summary>
                <div class="record-detail"><p>{{ worker.email }}</p><p>Rol: {{ worker.role }}</p></div>
              </details>
            } @empty { <p class="record-detail" role="status">No hay trabajadores con estos filtros.</p> }
          }
          @case ('roles') {
            @for (item of roles; track item.name) {
              <article class="record-detail"><h2>{{ item.name }}</h2><p>{{ item.permissions }}</p></article>
            }
          }
          @case ('activity') {
            @for (event of visibleActivity(); track event.time) {
              <article class="record-detail"><h2>{{ event.actor }}</h2><p>{{ event.action }} · {{ event.resource }}</p><small>{{ event.time }}</small></article>
            } @empty { <p class="record-detail" role="status">No hay registros para este trabajador.</p> }
          }
        }
      </div>
    </section>
  `,
})
export class WorkersPage {
  protected readonly workers = workers;
  protected readonly roles = roles;
  protected readonly view = signal('directory');
  protected readonly name = signal('');
  protected readonly role = signal('');
  protected readonly state = signal('');
  protected readonly actor = signal('');
  protected readonly visibleWorkers = computed(() => {
    const search = this.name().trim().toLowerCase();
    return workers.filter(worker =>
      worker.name.toLowerCase().includes(search) &&
      (!this.role() || worker.role === this.role()) &&
      (!this.state() || worker.state === this.state()),
    );
  });
  protected readonly visibleActivity = computed(() => activity.filter(event => !this.actor() || event.actor === this.actor()));
}
