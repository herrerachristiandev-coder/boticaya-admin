import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
export { adminRoutes } from './app.routes';

@Component({
  selector: 'botica-admin',
  imports: [RouterOutlet],
  template: `
    @if(router.currentNavigation()) { <div class="navigation-progress" role="status" aria-label="Cargando vista"></div> }
    <router-outlet />
  `,
})
export class AdminApp { protected readonly router = inject(Router); }
