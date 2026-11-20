import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { AdminApp, adminRoutes } from './app/admin';

bootstrapApplication(AdminApp, {
  providers: [provideRouter(adminRoutes, withInMemoryScrolling({ scrollPositionRestoration: 'top' }))],
}).catch(console.error);
