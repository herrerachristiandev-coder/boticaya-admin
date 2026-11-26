import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { AdminApi } from './admin-api';
import { adminRoutes } from './app.routes';
import { AdminApp } from './admin';

describe('Administrative frontend boundaries', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [provideRouter(adminRoutes), provideHttpClient(), provideHttpClientTesting()],
  }));

  it('redirects an unauthenticated inventory link to login', async () => {
    const router = TestBed.inject(Router);
    const http = TestBed.inject(HttpTestingController);
    const navigation = router.navigateByUrl('/inventario/lotes');
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    http.expectOne('/api/admin/v1/session').flush({}, { status: 401, statusText: 'Unauthorized' });
    await navigation;
    expect(router.url).toBe('/login?returnUrl=%2Finventario%2Flotes');
    http.verify();
  });

  it('shares simultaneous reads and requests a fresh result afterwards', async () => {
    const api = TestBed.inject(AdminApi);
    const http = TestBed.inject(HttpTestingController);
    const path = 'inventory/reports/indicators';
    const first = api.get(path);
    const second = api.get(path);
    http.expectOne('/api/admin/v1/' + path).flush({ data: {} });
    expect(await first).toEqual(await second);
    const refreshed = api.get(path);
    http.expectOne('/api/admin/v1/' + path).flush({ data: {} });
    await refreshed;
    http.verify();
  });

  it('renders dashboard indicators independently of a failed movements request', async () => {
    const router = TestBed.inject(Router);
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AdminApp);
    const navigation = router.navigateByUrl('/dashboard');
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    http.expectOne('/api/admin/v1/session').flush({
      user: { id: 'qa', email: 'qa@example.invalid', fullName: 'QA', roles: ['pharmacist'] },
    });
    await navigation;
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    http.expectOne('/api/admin/v1/dashboard/indicators').flush({
      data: { inventory: { products: '8', warehouses: '1', lots: '3', receipts: '2' }, catalog: null, operations: null },
      extensions_available: false,
    });
    http.expectOne('/api/admin/v1/inventory/paged-movements?limit=10').flush({}, {
      status: 503, statusText: 'Service Unavailable',
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(page.querySelector('.metric strong')?.textContent).toBe('8');
    expect(page.querySelector('[role=alert]')?.textContent).toContain('Reintentar');
    http.verify();
  });

  it('cancels an obsolete read when all subscribers unsubscribe', () => {
    const api = TestBed.inject(AdminApi);
    const http = TestBed.inject(HttpTestingController);
    const path = 'catalog/products?limit=25&q=old';
    const subscription = api.read(path).subscribe();
    const request = http.expectOne('/api/admin/v1/' + path);
    subscription.unsubscribe();
    expect(request.cancelled).toBe(true);
    const retried = firstValueFrom(api.read(path));
    http.expectOne('/api/admin/v1/' + path).flush({ data: [], next_cursor: null });
    return expect(retried).resolves.toEqual({ data: [], next_cursor: null });
  });

  it('sends versioned PATCH with the administrative headers and preserves its retry key', async () => {
    const api = TestBed.inject(AdminApi);
    const http = TestBed.inject(HttpTestingController);
    const path = 'catalog/products/catalog-id';
    const body = { expected_version: 3, status: 'archived' };
    const first = api.patch(path, body);
    const retryable = expect(first).rejects.toThrow('No se pudo completar');
    const attempt = http.expectOne({ method: 'PATCH', url: '/api/admin/v1/' + path });
    const key = attempt.request.headers.get('Idempotency-Key');
    expect(key).toBeTruthy();
    expect(attempt.request.headers.get('X-Botica-Request')).toBe('admin');
    expect(attempt.request.body).toEqual(body);
    attempt.flush({}, { status: 503, statusText: 'Unavailable' });
    await retryable;
    const retry = api.patch(path, body);
    const blocked = expect(retry).rejects.toThrow('extensión 021');
    const request = http.expectOne('/api/admin/v1/' + path);
    expect(request.request.headers.get('Idempotency-Key')).toBe(key);
    request.flush({}, { status: 501, statusText: 'Not Implemented' });
    await blocked;
    http.verify();
  });
});
