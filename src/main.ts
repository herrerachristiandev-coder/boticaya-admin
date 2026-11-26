import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { AdminApp } from './app/admin';
import { adminRoutes } from './app/app.routes';
import { provideHttpClient } from '@angular/common/http';

bootstrapApplication(AdminApp, {
  providers: [provideHttpClient(), provideRouter(adminRoutes, withInMemoryScrolling({ scrollPositionRestoration: 'top' }))],
}).catch(console.error);
