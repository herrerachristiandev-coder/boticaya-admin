import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminApi } from './admin-api';
import { CatalogStore } from './catalog-store';
import { InventoryStore } from './inventory-store';
import { adminGuard } from './auth-guard';
import { AuthSession } from './auth-session';

describe('Cloud inventory boundary', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('reads real report and history contracts without rounding bigint quantities or offering sales', async () => {
    const api = { get: vi.fn(async (path: string) => {
      if (path.includes('management/policy')) return { data: { commercial_enabled: false, sanitary_release_enabled: false } };
      if (path.includes('reports/stock')) return { data: [{ id: 'balance', physical_base: '9223372036854775807', reserved_base: '0', unreserved_base: '9223372036854775807', authorized_for_sale_base: '0' }], next_cursor: null };
      return { data: [], next_cursor: null };
    }) };
    const catalog = { allProducts: vi.fn(async () => []), references: vi.fn(async () => {}), error: signal('') };
    TestBed.configureTestingModule({ providers: [{ provide: AdminApi, useValue: api }, { provide: CatalogStore, useValue: catalog }] });
    const store = TestBed.inject(InventoryStore);
    await store.load();
    expect(store.error()).toBe('');
    expect(store.stock()[0].on_hand_base).toBe('9223372036854775807');
    expect(store.stock()[0].saleable_base).toBe('0');
    expect(store.policy()?.commercial_enabled).toBe(false);
    expect(api.get).toHaveBeenCalledWith('inventory/reports/stock?limit=10');
    expect(api.get).not.toHaveBeenCalledWith(expect.stringMatching(/paged-(receipts|lots|movements)/));
  });

  it('does not interpret a failed policy request as zero authorized stock', async () => {
    const api = { get: vi.fn(async () => { throw new Error('Conexión no disponible'); }) };
    TestBed.configureTestingModule({ providers: [{ provide: AdminApi, useValue: api }, { provide: CatalogStore, useValue: { allProducts: async () => [], references: async () => {}, error: signal('') } }] });
    const store = TestBed.inject(InventoryStore);
    await store.load();
    expect(store.error()).toBe('Conexión no disponible');
    expect(store.policy()).toBeNull();
  });

  it('preserves the requested inventory URL when a session is missing', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthSession, useValue: { restore: vi.fn(async () => null) } }] });
    const result = await TestBed.runInInjectionContext(() => adminGuard({} as never, { url: '/inventario/lotes' } as never));
    expect(TestBed.inject(Router).serializeUrl(result as never)).toBe('/login?returnUrl=%2Finventario%2Flotes');
  });
});
